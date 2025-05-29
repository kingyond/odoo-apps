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
        
        // 获取当前日期相关信息
        const today = new Date();
        const monthEnd = this.getMonthEnd(today);
        const quarterEnd = this.getQuarterEnd(today);
        const yearEnd = this.getYearEnd(today.getFullYear());
        
        this.state = useState({
            data: null,
            loading: false,
            options: {
                date_to: this.formatDateToYYYYMMDD(today),
                currentDateOption: 'today',
                currentMonthEnd: monthEnd,
                currentQuarterEnd: quarterEnd, 
                currentYear: today.getFullYear(),
                comparison_date_to: null,
                journal_ids: [],
                comparison_mode: false,
                company_id: this.company?.currentCompany?.id,
            },
            periodOptions: [
                { value: 'today', label: '今天' },
                { value: 'month_end', label: '月底' },
                { value: 'quarter_end', label: '季尾' },
                { value: 'year_end', label: '年底' }
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

    selectDateOption(option) {
        this.state.options.currentDateOption = option;
        let newDate;
        
        switch(option) {
            case 'today':
                newDate = new Date();
                break;
            case 'month':
                newDate = new Date(this.state.options.currentMonthEnd);
                break;
            case 'quarter':
                newDate = new Date(this.state.options.currentQuarterEnd);
                break;
            case 'year':
                newDate = new Date(this.state.options.currentYear, 11, 31); // 年度末
                break;
            case 'custom':
                // 保留当前日期，只显示日期选择器
                return;
            default:
                newDate = new Date();
        }
        
        this.state.options.date_to = newDate.toISOString().split('T')[0];
        this.loadBalanceSheet();
    }

    navigateDate(periodType, direction, event) {
        // 阻止事件冒泡和默认行为
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        
        switch(periodType) {
            case 'month': {
                // 更可靠的月份导航
                const [year, month] = this.state.options.currentMonthEnd.split('-').map((v, i) => i === 1 ? parseInt(v) - 1 : parseInt(v));
                let newMonth = month + direction;
                let newYear = year;
                
                // 处理年度溢出
                if (newMonth > 11) {
                    newMonth -= 12;
                    newYear += 1;
                } else if (newMonth < 0) {
                    newMonth += 12;
                    newYear -= 1;
                }
                
                const newDate = new Date(newYear, newMonth + 1, 0); // 下个月的第0天就是当前月的最后一天
                this.state.options.currentMonthEnd = this.formatDateToYYYYMMDD(newDate);
                
                // 如果当前选择的是月份，自动应用新日期并刷新
                if (this.state.options.currentDateOption === 'month') {
                    this.state.options.date_to = this.state.options.currentMonthEnd;
                    this.loadBalanceSheet();
                }
                break;
            }
            case 'quarter': {
                // 更可靠的季度导航
                const [year, month] = this.state.options.currentQuarterEnd.split('-').map((v, i) => i === 1 ? parseInt(v) - 1 : parseInt(v));
                
                // 计算当前季度
                const currentQuarter = Math.floor(month / 3);
                
                // 计算新的季度和年份
                let newQuarter = currentQuarter + direction;
                let newYear = year;
                
                // 处理年度溢出
                if (newQuarter > 3) {
                    newQuarter -= 4;
                    newYear += 1;
                } else if (newQuarter < 0) {
                    newQuarter += 4;
                    newYear -= 1;
                }
                
                // 计算新季度的最后一个月
                const lastMonthOfQuarter = newQuarter * 3 + 2; // 0-based, 所以+2是最后一个月
                
                // 创建新季度最后一天的日期
                const newDate = new Date(newYear, lastMonthOfQuarter + 1, 0); // 下个月的第0天
                this.state.options.currentQuarterEnd = this.formatDateToYYYYMMDD(newDate);
                
                if (this.state.options.currentDateOption === 'quarter') {
                    this.state.options.date_to = this.state.options.currentQuarterEnd;
                    this.loadBalanceSheet();
                }
                break;
            }
            case 'year': {
                this.state.options.currentYear += direction;
                if (this.state.options.currentDateOption === 'year') {
                    this.state.options.date_to = this.getYearEnd(this.state.options.currentYear);
                    this.loadBalanceSheet();
                }
                break;
            }
        }
        
        // 明确返回false以防止进一步的事件处理
        return false;
    }

    onCustomDateChange(event) {
        // 阻止事件冒泡，避免关闭下拉框
        event.stopPropagation();
        
        this.state.options.date_to = event.target.value;
        this.state.options.currentDateOption = 'custom';
        this.loadBalanceSheet();
        
        // 不自动关闭下拉框
        return false;
    }

    getDateDisplayText() {
        switch(this.state.options.currentDateOption) {
            case 'today':
                return `今天 (${this.formatSimpleDate(new Date())})`;
            case 'month':
                return `月底 (${this.formatMonthYear(this.state.options.currentMonthEnd)})`;
            case 'quarter':
                return `季尾 (${this.formatQuarter(this.state.options.currentQuarterEnd)})`;
            case 'year':
                return `年底 (${this.state.options.currentYear})`;
            case 'custom':
                return `自定义日期 (${this.formatSimpleDate(new Date(this.state.options.date_to))})`;
            default:
                return "选择日期";
        }
    }

    getMonthEnd(date) {
        // 获取下个月的第0天，即本月的最后一天
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        return this.formatDateToYYYYMMDD(lastDay);
    }

    getQuarterEnd(date) {
        // 计算当前季度
        const quarter = Math.floor(date.getMonth() / 3);
        // 计算季度的最后一个月 (0-based)
        const lastMonthOfQuarter = (quarter + 1) * 3 - 1;
        // 获取季度最后一个月的最后一天
        const lastDay = new Date(date.getFullYear(), lastMonthOfQuarter + 1, 0);
        return this.formatDateToYYYYMMDD(lastDay);
    }

    getYearEnd(year) {
        // 获取指定年份的12月31日
        const yearEnd = new Date(year, 11, 31);
        return this.formatDateToYYYYMMDD(yearEnd);
    }

    formatDateToYYYYMMDD(date) {
        // 获取本地日期组件，避免时区问题
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatSimpleDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        return this.formatDateToYYYYMMDD(date);
    }

    formatMonthYear(dateStr) {
        const date = new Date(dateStr);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    formatQuarter(dateStr) {
        const date = new Date(dateStr);
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        const quarterStartMonth = (quarter - 1) * 3 + 1;
        const quarterEndMonth = quarter * 3;
        return `${quarterStartMonth}-${quarterEndMonth} ${date.getFullYear()}`;
    }

    // 添加辅助方法解析日期字符串
    parseDateString(dateStr) {
        if (!dateStr) return new Date();
        
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    }
}

registry.category("actions").add("balance_sheet_view", BalanceSheetView);
