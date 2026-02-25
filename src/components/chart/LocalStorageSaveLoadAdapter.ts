// @ts-nocheck
export class LocalStorageSaveLoadAdapter {
    private _chartsKey = 'tv_charts';
    private _studyTemplatesKey = 'tv_study_templates';
    private _drawingTemplatesKey = 'tv_drawing_templates';
    private _chartTemplatesKey = 'tv_chart_templates';
    private _lineToolsKey = 'tv_line_tools';

    constructor() { }

    async getAllCharts() {
        return this._getFromStorage(this._chartsKey) || [];
    }

    async removeChart(id: string | number) {
        let charts = await this.getAllCharts();
        charts = charts.filter((c: any) => c.id !== id);
        this._saveToStorage(this._chartsKey, charts);
    }

    async saveChart(chartData: any) {
        const charts = await this.getAllCharts();
        if (!chartData.id) {
            chartData.id = Math.random().toString(36).substring(2, 9);
            chartData.timestamp = Date.now();
        } else {
            chartData.timestamp = Date.now();
        }

        const existingIndex = charts.findIndex((c: any) => c.id === chartData.id);
        if (existingIndex !== -1) {
            charts[existingIndex] = chartData;
        } else {
            charts.push(chartData);
        }

        this._saveToStorage(this._chartsKey, charts);
        return chartData.id;
    }

    async getChartContent(chartId: number | string) {
        const charts = await this.getAllCharts();
        const chart = charts.find((c: any) => c.id === chartId);
        return chart ? chart.content : '';
    }

    async getAllStudyTemplates() {
        return this._getFromStorage(this._studyTemplatesKey) || [];
    }

    async removeStudyTemplate(studyTemplateInfo: any) {
        let templates = await this.getAllStudyTemplates();
        templates = templates.filter((t: any) => t.name !== studyTemplateInfo.name);
        this._saveToStorage(this._studyTemplatesKey, templates);
    }

    async saveStudyTemplate(studyTemplateData: any) {
        const templates = await this.getAllStudyTemplates();
        const existingIndex = templates.findIndex((t: any) => t.name === studyTemplateData.name);
        if (existingIndex !== -1) {
            templates[existingIndex] = studyTemplateData;
        } else {
            templates.push(studyTemplateData);
        }
        this._saveToStorage(this._studyTemplatesKey, templates);
    }

    async getStudyTemplateContent(studyTemplateInfo: any) {
        const templates = await this.getAllStudyTemplates();
        const template = templates.find((t: any) => t.name === studyTemplateInfo.name);
        return template ? template.content : '';
    }

    async getDrawingTemplates(toolName: string) {
        const templates = this._getFromStorage(this._drawingTemplatesKey) || {};
        return templates[toolName] ? Object.keys(templates[toolName]) : [];
    }

    async loadDrawingTemplate(toolName: string, templateName: string) {
        const templates = this._getFromStorage(this._drawingTemplatesKey) || {};
        return templates[toolName] ? templates[toolName][templateName] : '';
    }

    async removeDrawingTemplate(toolName: string, templateName: string) {
        let templates = this._getFromStorage(this._drawingTemplatesKey) || {};
        if (templates[toolName] && templates[toolName][templateName]) {
            delete templates[toolName][templateName];
            this._saveToStorage(this._drawingTemplatesKey, templates);
        }
    }

    async saveDrawingTemplate(toolName: string, templateName: string, content: string) {
        let templates = this._getFromStorage(this._drawingTemplatesKey) || {};
        if (!templates[toolName]) {
            templates[toolName] = {};
        }
        templates[toolName][templateName] = content;
        this._saveToStorage(this._drawingTemplatesKey, templates);
    }

    async getChartTemplateContent(templateName: string) {
        const templates = this._getFromStorage(this._chartTemplatesKey) || {};
        return templates[templateName] || {};
    }

    async getAllChartTemplates() {
        const templates = this._getFromStorage(this._chartTemplatesKey) || {};
        return Object.keys(templates);
    }

    async saveChartTemplate(newName: string, theme: any) {
        let templates = this._getFromStorage(this._chartTemplatesKey) || {};
        templates[newName] = theme;
        this._saveToStorage(this._chartTemplatesKey, templates);
    }

    async removeChartTemplate(templateName: string) {
        let templates = this._getFromStorage(this._chartTemplatesKey) || {};
        if (templates[templateName]) {
            delete templates[templateName];
            this._saveToStorage(this._chartTemplatesKey, templates);
        }
    }

    async saveLineToolsAndGroups(layoutId: string | undefined, chartId: string | number, state: any) {
        let tools = this._getFromStorage(this._lineToolsKey) || {};
        const key = `${layoutId}_${chartId}`;
        tools[key] = state;
        this._saveToStorage(this._lineToolsKey, tools);
    }

    async loadLineToolsAndGroups(layoutId: string | undefined, chartId: string | number, requestType: any, requestContext: any) {
        const tools = this._getFromStorage(this._lineToolsKey) || {};
        const key = `${layoutId}_${chartId}`;
        return tools[key] || null;
    }

    private _getFromStorage(key: string) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error reading from local storage', e);
            return null;
        }
    }

    private _saveToStorage(key: string, data: any) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('Error saving to local storage', e);
        }
    }
}
