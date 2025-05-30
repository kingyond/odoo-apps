from odoo import models, fields, api
from datetime import datetime, date
import calendar

class BalanceSheetReport(models.TransientModel):
    _name = 'balance.sheet.report'
    _description = '资产负债表报告'

    date_from = fields.Date('开始日期', required=True, default=fields.Date.context_today)
    date_to = fields.Date('结束日期', required=True, default=fields.Date.context_today)
    journal_ids = fields.Many2many('account.journal', string='日记账')
    comparison_date_to = fields.Date('比较日期')
    comparison_mode = fields.Boolean('比较模式', default=False)

    @api.model
    def get_balance_sheet_data(self, options):
        """获取资产负债表数据"""
        # 确保使用正确的公司上下文
        company_id = options.get('company_id', self.env.company.id)
        report_model = self.with_company(self.env['res.company'].browse(company_id))

        date_to = options.get('date_to', fields.Date.context_today(report_model))
        journal_ids = options.get('journal_ids', [])
        comparison_date_to = options.get('comparison_date_to')
        
        # 获取科目数据
        accounts = report_model._get_accounts_data(date_to, journal_ids)
        
        result = {
            'assets': report_model._get_assets_data(accounts, date_to),
            'liabilities': report_model._get_liabilities_data(accounts, date_to),
            'equity': report_model._get_equity_data(accounts, date_to),
            'date_to': date_to,
            'company_id': report_model.env.company.id,
            'company_name': report_model.env.company.name,
        }
        
        # 处理多期间比较
        comparison_dates = options.get('comparisonDates', [])
        if comparison_dates:
            result['comparisons'] = []
            
            for comparison_date in comparison_dates:
                comparison_accounts = report_model._get_accounts_data(comparison_date, journal_ids)
                comparison_data = {
                    'assets': report_model._get_assets_data(comparison_accounts, comparison_date),
                    'liabilities': report_model._get_liabilities_data(comparison_accounts, comparison_date),
                    'equity': report_model._get_equity_data(comparison_accounts, comparison_date),
                    'date_to': comparison_date,
                }
                result['comparisons'].append(comparison_data)
        
        return result

    def _get_accounts_data(self, date_to, journal_ids):
        """获取科目余额数据"""
        domain = [
            ('date', '<=', date_to),
            ('move_id.state', '=', 'posted'),  # 只查询已过账的分录
            ('company_id', '=', self.env.company.id)  # 按当前公司过滤
        ]
        if journal_ids:
            domain.append(('journal_id', 'in', journal_ids))
        
        move_lines = self.env['account.move.line'].search(domain)
        account_balances = {}
        
        for line in move_lines:
            account_id = line.account_id.id
            if account_id not in account_balances:
                account_balances[account_id] = {
                    'account': line.account_id,
                    'balance': 0,
                }
            account_balances[account_id]['balance'] += line.balance
        
        return account_balances

    def _get_assets_data(self, accounts, date_to):
        """获取资产数据"""
        assets_accounts = []
        for account_data in accounts.values():
            account = account_data['account']
            if account.account_type in ['asset_receivable', 'asset_cash', 'asset_current', 'asset_non_current', 'asset_prepayments', 'asset_fixed']:
                assets_accounts.append({
                    'id': account.id,
                    'code': account.code,
                    'name': account.name,
                    'balance': account_data['balance'],
                    'level': len(account.code),
                    'parent_id': account.parent_id.id if account.parent_id else False,
                })
        return self._build_tree_structure(assets_accounts)

    def _get_liabilities_data(self, accounts, date_to):
        """获取负债数据"""
        liabilities_accounts = []
        for account_data in accounts.values():
            account = account_data['account']
            if account.account_type in ['liability_payable', 'liability_current', 'liability_non_current']:
                liabilities_accounts.append({
                    'id': account.id,
                    'code': account.code,
                    'name': account.name,
                    'balance': abs(account_data['balance']),
                    'level': len(account.code),
                    'parent_id': account.parent_id.id if account.parent_id else False,
                })
        return self._build_tree_structure(liabilities_accounts)

    def _get_equity_data(self, accounts, date_to):
        """获取权益数据"""
        equity_accounts = []
        for account_data in accounts.values():
            account = account_data['account']
            if account.account_type in ['equity', 'equity_unaffected']:
                equity_accounts.append({
                    'id': account.id,
                    'code': account.code,
                    'name': account.name,
                    'balance': abs(account_data['balance']),
                    'level': len(account.code),
                    'parent_id': account.parent_id.id if account.parent_id else False,
                })
        return self._build_tree_structure(equity_accounts)

    def _build_tree_structure(self, accounts):
        """构建树状结构"""
        # 简化的树状结构构建
        return sorted(accounts, key=lambda x: x['code'])

    @api.model
    def get_period_options(self):
        """获取时间段选项"""
        today = date.today()
        return [
            {'value': 'today', 'label': '今天', 'date': today},
            {'value': 'month_end', 'label': '月底', 'date': date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])},
            {'value': 'quarter_end', 'label': '季度末', 'date': self._get_quarter_end(today)},
            {'value': 'year_end', 'label': '年末', 'date': date(today.year, 12, 31)},
            {'value': 'custom', 'label': '指定日期', 'date': today},
        ]

    def _get_quarter_end(self, date_obj):
        """获取季度末日期"""
        quarter = (date_obj.month - 1) // 3 + 1
        if quarter == 1:
            return date(date_obj.year, 3, 31)
        elif quarter == 2:
            return date(date_obj.year, 6, 30)
        elif quarter == 3:
            return date(date_obj.year, 9, 30)
        else:
            return date(date_obj.year, 12, 31)
