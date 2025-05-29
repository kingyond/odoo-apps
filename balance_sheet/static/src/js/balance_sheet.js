/** @odoo-module **/

import { Component, useState, onMounted, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

class BalanceSheetView extends Component {
    static template = "balance_sheet.balance_sheet_view_template";
    
    setup() {
        this.rpc = useService("rpc");
        this.orm = useService("orm");
        this.company = useService("company");
        
        this.state = useState({
            data: null,
            loading: false,
            options: {
                date_to: new Date().toISOString().split('T')[0],
                comparison_date_to: null,
                journal_ids: [],
                comparison_mode: false,
                company_id: this.company?.currentCompany?.id,
            },
            periodOptions: [
                { value: 'today', label: '今天' },
                { value: 'month_end', label: '月底' },
                { value: 'quarter_end', label: '季度末' },
                { value: 'year_end', label: '年末' }
            ],
            journals: [],
            expandedSections: {
                assets: true,
                liabilities: true,
                equity: true,
            },
            currentCompanyId: this.company?.currentCompany?.id,
        });
        
        // 使用 useEffect 监听公司变更
        useEffect(
            () => {
                if (this.state.currentCompanyId !== this.company?.currentCompany?.id) {
                    this.onCompanyChanged();
                }
                this.state.currentCompanyId = this.company?.currentCompany?.id;
            },
            () => [this.company?.currentCompany?.id]
        );
        
        onMounted(async () => {
            await this.loadInitialData();
            await this.loadBalanceSheet();
        });
    }

    async onCompanyChanged() {
        // 公司变更时更新数据
        this.state.options.journal_ids = [];
        this.state.options.company_id = this.company?.currentCompany?.id;
        await this.loadInitialData();
        await this.loadBalanceSheet();
    }

    async loadInitialData() {
        try {
            // 使用ORM服务代替原来的RPC调用
            const currentCompanyId = this.company?.currentCompany?.id;
            const domain = currentCompanyId ? [['company_id', '=', currentCompanyId]] : [];
            
            const journals = await this.orm.searchRead(
                "account.journal",
                domain,
                ["id", "name"]
            );
            this.state.journals = journals || [];
        } catch (error) {
            console.error("加载初始数据失败:", error);
            this.state.journals = [];
        }
    }

    async loadBalanceSheet() {
        this.state.loading = true;
        try {
            const options = { ...this.state.options };
            options.company_id = this.company?.currentCompany?.id;
            
            // 使用ORM服务调用模型方法
            const data = await this.orm.call(
                "balance.sheet.report",
                "get_balance_sheet_data",
                [options]
            );
            
            this.state.data = data;
        } catch (error) {
            console.error("加载资产负债表失败:", error);
            this.state.data = {
                assets: [],
                liabilities: [],
                equity: [],
                date_to: this.state.options.date_to
            };
        } finally {
            this.state.loading = false;
        }
    }

    onPeriodChange(event) {
        const period = event.target.value;
        this.loadBalanceSheet();
    }

    onComparisonModeChange(event) {
        this.state.options.comparison_mode = event.target.checked;
        if (!this.state.options.comparison_mode) {
            this.state.options.comparison_date_to = null;
        }
        this.loadBalanceSheet();
    }

    onComparisonDateChange(event) {
        this.state.options.comparison_date_to = event.target.value;
        this.loadBalanceSheet();
    }

    onJournalChange(event) {
        const selectedOptions = Array.from(event.target.selectedOptions);
        this.state.options.journal_ids = selectedOptions.map(option => parseInt(option.value));
        this.loadBalanceSheet();
    }

    toggleSection(section) {
        this.state.expandedSections[section] = !this.state.expandedSections[section];
    }

    exportPDF() {
        const options = JSON.stringify(this.state.options);
        const url = `/balance_sheet/export/pdf?options=${encodeURIComponent(options)}&company_id=${this.company?.currentCompany?.id}`;
        window.open(url, '_blank');
    }

    exportXLSX() {
        const options = JSON.stringify(this.state.options);
        const url = `/balance_sheet/export/xlsx?options=${encodeURIComponent(options)}&company_id=${this.company?.currentCompany?.id}`;
        window.open(url, '_blank');
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: 'CNY'
        }).format(amount || 0);
    }

    getTotalBalance(accounts) {
        if (!accounts || !Array.isArray(accounts)) {
            return 0;
        }
        return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    }

    toggleJournal(journalId) {
        const index = this.state.options.journal_ids.indexOf(journalId);
        if (index === -1) {
            // 添加日记账
            this.state.options.journal_ids.push(journalId);
        } else {
            // 移除日记账
            this.state.options.journal_ids.splice(index, 1);
        }
        this.loadBalanceSheet();
    }

    selectAllJournals() {
        // 清空选择，表示选择所有日记账
        this.state.options.journal_ids = [];
        this.loadBalanceSheet();
    }

    getSelectedJournalsText() {
        if (this.state.options.journal_ids.length === 0) {
            return "所有日记账";
        }
        
        if (this.state.options.journal_ids.length === 1) {
            const journal = this.state.journals.find(j => j.id === this.state.options.journal_ids[0]);
            return journal ? journal.name : "选择日记账";
        }
        
        return `已选择 ${this.state.options.journal_ids.length} 个日记账`;
    }
}

registry.category("actions").add("balance_sheet_view", BalanceSheetView);
