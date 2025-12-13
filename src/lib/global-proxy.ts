import { ProxyAgent, setGlobalDispatcher } from 'undici';

export function setupGlobalProxy() {
    const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY;
    const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY;
    const allProxy = process.env.all_proxy || process.env.ALL_PROXY;

    // Logic: Specific proxy > All proxy > None
    const targetHttpProxy = httpProxy || allProxy;
    const targetHttpsProxy = httpsProxy || allProxy;

    if (targetHttpProxy || targetHttpsProxy) {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Proxy Setup] Configuring proxy...`);
            if (targetHttpProxy) console.log(`  HTTP:  ${targetHttpProxy}`);
            if (targetHttpsProxy) console.log(`  HTTPS: ${targetHttpsProxy}`);
        }

        // 1. Configure Undici (global fetch)
        // Undici accepts a single dispatcher.
        // For general usage (APIs, etc.), we usually care about the HTTPS proxy.
        // If only HTTP is available, fall back to that.
        const undiciProxy = targetHttpsProxy || targetHttpProxy;
        if (undiciProxy) {
            try {
                const proxyAgent = new ProxyAgent(undiciProxy);
                setGlobalDispatcher(proxyAgent);
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[Proxy Setup] Global Undici dispatcher set to: ${undiciProxy}`);
                }
            } catch (error) {
                console.error('[Proxy Setup] Failed to set global Undici dispatcher:', error);
            }
        }

        // 2. Configure legacy http/https modules using global-agent
        try {
            // We set the environment variables that global-agent looks for
            if (targetHttpProxy) process.env.GLOBAL_AGENT_HTTP_PROXY = targetHttpProxy;
            if (targetHttpsProxy) process.env.GLOBAL_AGENT_HTTPS_PROXY = targetHttpsProxy;

            // Also set the global config object which global-agent uses
            // @ts-ignore
            global.GLOBAL_AGENT = {
                HTTP_PROXY: targetHttpProxy,
                HTTPS_PROXY: targetHttpsProxy,
            };

            // Import bootstrap to patch http/https
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require('global-agent/bootstrap');

            if (process.env.NODE_ENV === 'development') {
                console.log('[Proxy Setup] global-agent/bootstrap initialized.');
            }
        } catch (error) {
            console.error('[Proxy Setup] Failed to initialize global-agent:', error);
        }
    }
}
