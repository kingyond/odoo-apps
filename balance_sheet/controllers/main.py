from odoo import http
from odoo.http import request
import json
import io
import xlsxwriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle

class BalanceSheetController(http.Controller):

    @http.route('/balance_sheet/export/pdf', type='http', auth='user')
    def export_pdf(self, **kw):
        """导出PDF格式资产负债表"""
        options = json.loads(kw.get('options', '{}'))
        # 确保传递公司ID参数
        company_id = int(kw.get('company_id', request.env.company.id))
        options['company_id'] = company_id
        
        data = request.env['balance.sheet.report'].with_company(
            request.env['res.company'].browse(company_id)
        ).get_balance_sheet_data(options)
        
        # 创建PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        
        # 添加标题
        title_data = [['资产负债表']]
        title_table = Table(title_data)
        title_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, -1), 16),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ]))
        elements.append(title_table)
        
        # 构建表格数据
        table_data = self._build_pdf_table_data(data)
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(table)
        
        doc.build(elements)
        pdf_data = buffer.getvalue()
        buffer.close()
        
        return request.make_response(
            pdf_data,
            headers=[
                ('Content-Type', 'application/pdf'),
                ('Content-Disposition', 'attachment; filename="balance_sheet.pdf"')
            ]
        )

    @http.route('/balance_sheet/export/xlsx', type='http', auth='user')
    def export_xlsx(self, **kw):
        """导出XLSX格式资产负债表"""
        options = json.loads(kw.get('options', '{}'))
        # 确保传递公司ID参数
        company_id = int(kw.get('company_id', request.env.company.id))
        options['company_id'] = company_id
        
        data = request.env['balance.sheet.report'].with_company(
            request.env['res.company'].browse(company_id)
        ).get_balance_sheet_data(options)
        
        # 创建Excel文件
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output)
        worksheet = workbook.add_worksheet('资产负债表')
        
        # 设置格式
        title_format = workbook.add_format({
            'bold': True,
            'font_size': 16,
            'align': 'center',
            'valign': 'vcenter'
        })
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#D7E4BC',
            'border': 1
        })
        cell_format = workbook.add_format({'border': 1})
        
        # 写入标题
        worksheet.merge_range('A1:D1', '资产负债表', title_format)
        
        # 写入表头
        row = 2
        worksheet.write(row, 0, '科目', header_format)
        worksheet.write(row, 1, '金额', header_format)
        if 'comparison' in data:
            worksheet.write(row, 2, '比较科目', header_format)
            worksheet.write(row, 3, '比较金额', header_format)
        
        # 写入数据
        row += 1
        row = self._write_xlsx_section(worksheet, row, '资产', data['assets'], cell_format, data.get('comparison', {}).get('assets', []))
        row = self._write_xlsx_section(worksheet, row, '负债', data['liabilities'], cell_format, data.get('comparison', {}).get('liabilities', []))
        row = self._write_xlsx_section(worksheet, row, '权益', data['equity'], cell_format, data.get('comparison', {}).get('equity', []))
        
        workbook.close()
        xlsx_data = output.getvalue()
        output.close()
        
        return request.make_response(
            xlsx_data,
            headers=[
                ('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
                ('Content-Disposition', 'attachment; filename="balance_sheet.xlsx"')
            ]
        )

    def _build_pdf_table_data(self, data):
        """构建PDF表格数据"""
        table_data = [['科目', '金额']]
        if 'comparison' in data:
            table_data[0].extend(['比较科目', '比较金额'])
        
        # 添加资产数据
        table_data.append(['资产', ''])
        for account in data['assets']:
            table_data.append([account['name'], f"{account['balance']:,.2f}"])
        
        # 添加负债数据
        table_data.append(['负债', ''])
        for account in data['liabilities']:
            table_data.append([account['name'], f"{account['balance']:,.2f}"])
        
        # 添加权益数据
        table_data.append(['权益', ''])
        for account in data['equity']:
            table_data.append([account['name'], f"{account['balance']:,.2f}"])
        
        return table_data

    def _write_xlsx_section(self, worksheet, start_row, section_name, accounts, cell_format, comparison_accounts=None):
        """写入Excel章节数据"""
        row = start_row
        worksheet.write(row, 0, section_name, cell_format)
        row += 1
        
        for account in accounts:
            worksheet.write(row, 0, account['name'], cell_format)
            worksheet.write(row, 1, account['balance'], cell_format)
            row += 1
        
        if comparison_accounts:
            comp_row = start_row + 1
            for account in comparison_accounts:
                if comp_row <= row:
                    worksheet.write(comp_row, 2, account['name'], cell_format)
                    worksheet.write(comp_row, 3, account['balance'], cell_format)
                comp_row += 1
        
        return row
