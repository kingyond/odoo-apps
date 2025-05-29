{
    'name': '资产负债表',
    'version': '17.0.1.0.0',
    'category': '会计',
    'summary': '资产负债表查看和导出',
    'description': '''
        资产负债表模块功能：
        - 查看资产负债表
        - PDF和XLSX格式导出
        - 时间段选择
        - 比较功能
        - 科目树状结构
    ''',
    'author': 'Your Company',
    'depends': ['account', 'web'],
    'data': [
        'security/ir.model.access.csv',
        'views/balance_sheet_views.xml',
        'views/menu_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'balance_sheet/static/src/js/balance_sheet.js',
            'balance_sheet/static/src/css/balance_sheet.css',
            'balance_sheet/static/src/xml/balance_sheet_templates.xml',
        ],
    },
    'installable': True,
    'auto_install': False,
}
