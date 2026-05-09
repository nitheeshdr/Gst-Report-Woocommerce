<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class GST_XLSX_Writer {

    private array $rows = [];

    public function add_row( array $row, bool $bold = false ): void {
        $this->rows[] = [ 'data' => $row, 'bold' => $bold ];
    }

    public function output( string $filename ): void {
        if ( ! class_exists( 'ZipArchive' ) ) {
            // Fallback: deliver as CSV if ZipArchive missing
            header( 'Content-Type: text/csv; charset=utf-8' );
            header( 'Content-Disposition: attachment; filename="' . str_replace( '.xlsx', '.csv', $filename ) . '"' );
            $out = fopen( 'php://output', 'w' );
            fprintf( $out, "\xEF\xBB\xBF" );
            foreach ( $this->rows as $r ) {
                fputcsv( $out, $r['data'] );
            }
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- operating on php://output stream, not a filesystem file
            fclose( $out );
            return;
        }

        $tmp = wp_tempnam( 'gst_xlsx_' );
        $zip = new ZipArchive();
        $zip->open( $tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE );
        $zip->addFromString( '[Content_Types].xml',       $this->xml_content_types() );
        $zip->addFromString( '_rels/.rels',                $this->xml_root_rels() );
        $zip->addFromString( 'xl/workbook.xml',            $this->xml_workbook() );
        $zip->addFromString( 'xl/_rels/workbook.xml.rels', $this->xml_workbook_rels() );
        $zip->addFromString( 'xl/styles.xml',              $this->xml_styles() );
        $zip->addFromString( 'xl/worksheets/sheet1.xml',   $this->xml_sheet() );
        $zip->close();

        header( 'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' );
        header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
        header( 'Content-Length: ' . filesize( $tmp ) );
        header( 'Cache-Control: max-age=0' );

        if ( ! function_exists( 'WP_Filesystem' ) ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        global $wp_filesystem;
        WP_Filesystem();
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile -- streaming temp file to browser for download; WP_Filesystem::get_contents() is used to read the file.
        echo $wp_filesystem->get_contents( $tmp ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- binary XLSX data must not be escaped
        wp_delete_file( $tmp );
    }

    private static function col_ref( int $col, int $row ): string {
        $letter = '';
        $c      = $col;
        while ( $c >= 0 ) {
            $letter = chr( $c % 26 + 65 ) . $letter;
            $c      = intdiv( $c, 26 ) - 1;
        }
        return $letter . $row;
    }

    private function xml_sheet(): string {
        $parts = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
            ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
            '<sheetData>',
        ];

        foreach ( $this->rows as $ri => $row_data ) {
            $r     = $ri + 1;
            $style = $row_data['bold'] ? ' s="1"' : '';
            $parts[] = "<row r=\"$r\">";
            foreach ( $row_data['data'] as $ci => $val ) {
                $ref = self::col_ref( $ci, $r );
                if ( is_numeric( $val ) && $val !== '' ) {
                    $parts[] = "<c r=\"$ref\"$style><v>" . $val . '</v></c>';
                } else {
                    $esc     = htmlspecialchars( (string) $val, ENT_XML1, 'UTF-8' );
                    $parts[] = "<c r=\"$ref\" t=\"inlineStr\"$style><is><t>$esc</t></is></c>";
                }
            }
            $parts[] = '</row>';
        }

        $parts[] = '</sheetData></worksheet>';
        return implode( '', $parts );
    }

    private function xml_styles(): string {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
             . '<fonts count="2">'
             . '<font><sz val="11"/><name val="Calibri"/></font>'
             . '<font><b/><sz val="11"/><name val="Calibri"/></font>'
             . '</fonts>'
             . '<fills count="2">'
             . '<fill><patternFill patternType="none"/></fill>'
             . '<fill><patternFill patternType="gray125"/></fill>'
             . '</fills>'
             . '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
             . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
             . '<cellXfs count="2">'
             . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
             . '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>'
             . '</cellXfs>'
             . '</styleSheet>';
    }

    private function xml_content_types(): string {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
             . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
             . '<Default Extension="xml" ContentType="application/xml"/>'
             . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
             . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
             . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
             . '</Types>';
    }

    private function xml_root_rels(): string {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
             . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
             . '</Relationships>';
    }

    private function xml_workbook(): string {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
             . ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
             . '<sheets><sheet name="GST Report" sheetId="1" r:id="rId1"/></sheets>'
             . '</workbook>';
    }

    private function xml_workbook_rels(): string {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
             . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
             . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
             . '</Relationships>';
    }
}
