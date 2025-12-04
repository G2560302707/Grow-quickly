type RequestOptions = RequestInit & {
    params?: Record<string, string>;
};

class ApiError extends Error {
    constructor(public status: number, public statusText: string, public data: any) {
        super(`API Error: ${status} ${statusText}`);
        this.name = 'ApiError';
    }
}

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, ...rest } = options;

    let finalUrl = url;
    if (params) {
        const searchParams = new URLSearchParams(params);
        finalUrl += `?${searchParams.toString()}`;
    }

    const defaultHeaders: HeadersInit = {
        'Content-Type': 'application/json',
    };

    const res = await fetch(finalUrl, {
        headers: {
            ...defaultHeaders,
            ...headers,
        },
        ...rest,
    });

    if (!res.ok) {
        let errorData;
        try {
            errorData = await res.json();
        } catch (e) {
            errorData = await res.text();
        }
        throw new ApiError(res.status, res.statusText, errorData);
    }

    // Handle empty responses (e.g. 204 No Content)
    if (res.status === 204) {
        return {} as T;
    }

    try {
        return await res.json();
    } catch (e) {
        // If JSON parse fails but response was OK, return text or empty object?
        // For now, assume JSON APIs.
        return {} as T;
    }
}

export const apiClient = {
    get: <T>(url: string, options?: RequestOptions) => request<T>(url, { ...options, method: 'GET' }),
    post: <TResponse, TBody = any>(url: string, body: TBody, options?: RequestOptions) => request<TResponse>(url, { ...options, method: 'POST', body: JSON.stringify(body) }),
    put: <TResponse, TBody = any>(url: string, body: TBody, options?: RequestOptions) => request<TResponse>(url, { ...options, method: 'PUT', body: JSON.stringify(body) }),
    patch: <TResponse, TBody = any>(url: string, body: TBody, options?: RequestOptions) => request<TResponse>(url, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(url: string, options?: RequestOptions) => request<T>(url, { ...options, method: 'DELETE' }),
};
