import type { ApiResponse, PaginatedResponse, QueryParams } from "@pipesync/types";

class ApiClient {
  private baseUrl: string;
  private getToken: () => Promise<string | null>;

  constructor(config: { baseUrl: string; getToken: () => Promise<string | null> }) {
    this.baseUrl = config.baseUrl;
    this.getToken = config.getToken;
  }

  private async headers() {
    const token = await this.getToken();
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }

  async get<T>(path: string, params?: QueryParams): Promise<ApiResponse<T>> {
    const qs = params ? "?" + new URLSearchParams(this.buildParams(params)).toString() : "";
    const res = await fetch(`${this.baseUrl}${path}${qs}`, {
      headers: await this.headers(),
    });
    return res.json();
  }

  async post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async patch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: await this.headers(),
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers: await this.headers(),
    });
    return res.json();
  }

  private buildParams(params: QueryParams): Record<string, string> {
    const result: Record<string, string> = {};
    if (params.page) result.page = String(params.page);
    if (params.pageSize) result.pageSize = String(params.pageSize);
    if (params.search) result.search = params.search;
    if (params.sortBy) result.sortBy = params.sortBy;
    if (params.sortOrder) result.sortOrder = params.sortOrder;
    return result;
  }
}

export { ApiClient };
export type { ApiResponse, PaginatedResponse, QueryParams };

