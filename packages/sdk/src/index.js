class ApiClient {
    baseUrl;
    getToken;
    constructor(config) {
        this.baseUrl = config.baseUrl;
        this.getToken = config.getToken;
    }
    async headers() {
        const token = await this.getToken();
        const h = {
            "Content-Type": "application/json",
        };
        if (token)
            h["Authorization"] = `Bearer ${token}`;
        return h;
    }
    async get(path, params) {
        const qs = params ? "?" + new URLSearchParams(this.buildParams(params)).toString() : "";
        const res = await fetch(`${this.baseUrl}${path}${qs}`, {
            headers: await this.headers(),
        });
        return res.json();
    }
    async post(path, body) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: "POST",
            headers: await this.headers(),
            body: JSON.stringify(body),
        });
        return res.json();
    }
    async patch(path, body) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: "PATCH",
            headers: await this.headers(),
            body: JSON.stringify(body),
        });
        return res.json();
    }
    async delete(path) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: "DELETE",
            headers: await this.headers(),
        });
        return res.json();
    }
    buildParams(params) {
        const result = {};
        if (params.page)
            result.page = String(params.page);
        if (params.pageSize)
            result.pageSize = String(params.pageSize);
        if (params.search)
            result.search = params.search;
        if (params.sortBy)
            result.sortBy = params.sortBy;
        if (params.sortOrder)
            result.sortOrder = params.sortOrder;
        return result;
    }
}
export { ApiClient };
