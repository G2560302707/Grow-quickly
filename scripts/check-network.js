/**
 * 网络连接测试脚本
 * 功能：
 * 1. 测试 DNS 解析 (1.1.1.1)。
 * 2. 测试对 Google API (generativelanguage.googleapis.com) 的连通性。
 * 用途：用于排查服务器网络问题，特别是确认是否能连接到境外 AI 服务接口。
 */
const dns = require('dns');

console.log("Testing network connectivity...");

// 1. Test DNS resolution
dns.lookup('generativelanguage.googleapis.com', (err, address, family) => {
    if (err) {
        console.error('❌ DNS Lookup failed:', err);
    } else {
        console.log('✅ DNS Lookup successful:', address);

        // 2. Test Fetch
        console.log('Testing fetch to Google API...');
        fetch('https://generativelanguage.googleapis.com', { method: 'HEAD' })
            .then(res => console.log(`✅ Fetch successful. Status: ${res.status}`))
            .catch(err => {
                console.error('❌ Fetch failed:', err);
                if (err.cause) console.error('Cause:', err.cause);
            });
    }
});
