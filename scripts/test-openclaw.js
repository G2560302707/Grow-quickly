#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const MOCK_OPENCLAW_PORT = 8080;
const WRONG_NOTEBOOK_URL = process.env.WRONG_NOTEBOOK_URL || 'http://localhost:3000';
const API_KEY = 'test-api-key-12345';

const mockOpenclawServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/recognize') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            console.log(`[Mock Openclaw] 收到识别请求`);

            setTimeout(() => {
                const response = {
                    success: true,
                    data: {
                        questionText: '已知函数 f(x) = x² + 2x + 1，求 f(3) 的值。',
                        answerText: 'f(3) = 3² + 2×3 + 1 = 9 + 6 + 1 = 16',
                        analysis: '这是一个关于函数求值的题目。首先将 x=3 代入函数表达式，然后进行计算。',
                        knowledgePoints: ['函数', '代数代入', '平方运算'],
                        subject: '数学',
                        errorType: '计算错误',
                        source: '期末考试'
                    }
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            }, 100);
        });
    } else if (req.method === 'POST' && req.url === '/api/recognize-error') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            console.log(`[Mock Openclaw] 收到会失败的识别请求`);
            res.writeHead(500);
            res.end(JSON.stringify({ error: '识别失败' }));
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

function startMockOpenclaw() {
    return new Promise((resolve) => {
        mockOpenclawServer.listen(MOCK_OPENCLAW_PORT, () => {
            console.log(`✅ Mock Openclaw 服务已启动 (端口 ${MOCK_OPENCLAW_PORT})`);
            resolve();
        });
    });
}

function stopMockOpenclaw() {
    return new Promise((resolve) => {
        mockOpenclawServer.close(() => {
            console.log(`✅ Mock Openclaw 服务已停止`);
            resolve();
        });
    });
}

function httpRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const url = new URL(WRONG_NOTEBOOK_URL);
        const req = http.request({
            hostname: url.hostname,
            port: url.port || 80,
            path: options.path,
            method: options.method || 'GET',
            headers: options.headers || {}
        }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                resolve({ status: res.statusCode, body: data });
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

async function runTests() {
    console.log('\n=========================================');
    console.log('Openclaw 批量上传接口测试');
    console.log('=========================================\n');

    await startMockOpenclaw();

    let passed = 0;
    let failed = 0;

    async function test(name, expectedStatus, requestBody, apiKey = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
            headers['X-Api-Key'] = apiKey;
        }

        try {
            const result = await httpRequest({
                path: '/api/openclaw/batch-upload',
                method: 'POST',
                headers
            }, JSON.stringify(requestBody));

            const actualStatus = result.status;
            const success = actualStatus === expectedStatus;

            if (success) {
                console.log(`✅ ${name} (期望: ${expectedStatus}, 实际: ${actualStatus})`);
                passed++;
            } else {
                console.log(`❌ ${name} (期望: ${expectedStatus}, 实际: ${actualStatus})`);
                console.log(`   响应: ${result.body.substring(0, 200)}`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ ${name} - 请求失败: ${error.message}`);
            failed++;
        }
    }

    console.log('\n--- 认证测试 ---\n');

    await test(
        '测试1: 无API密钥',
        401,
        { userEmail: 'admin@localhost', images: [] }
    );

    await test(
        '测试2: 无效API密钥',
        401,
        { userEmail: 'admin@localhost', images: [] },
        'wrong-key'
    );

    console.log('\n--- 参数验证测试 ---\n');

    await test(
        '测试3: 空图片数组',
        400,
        { userEmail: 'admin@localhost', images: [] },
        API_KEY
    );

    await test(
        '测试4: 图片数量超限 (21张)',
        400,
        { 
            userEmail: 'admin@localhost', 
            images: Array(21).fill({ base64: 'abc', mimeType: 'image/jpeg', filename: 'test.jpg' })
        },
        API_KEY
    );

    await test(
        '测试5: 用户不存在',
        404,
        { userEmail: 'notexist@example.com', images: [{ base64: 'abc', mimeType: 'image/jpeg', filename: 'test.jpg' }] },
        API_KEY
    );

    await test(
        '测试6: 不支持的图片格式 (返回207表示部分成功)',
        207,
        { userEmail: 'admin@localhost', images: [{ base64: 'abc', mimeType: 'image/gif', filename: 'test.gif' }] },
        API_KEY
    );

    console.log('\n--- 功能测试 ---\n');

    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    await test(
        '测试7: 成功上传单张图片',
        201,
        { 
            userEmail: 'admin@localhost', 
            images: [{ base64: testImageBase64, mimeType: 'image/png', filename: 'test.png' }] 
        },
        API_KEY
    );

    await test(
        '测试8: 批量上传多张图片',
        201,
        { 
            userEmail: 'admin@localhost', 
            images: [
                { base64: testImageBase64, mimeType: 'image/png', filename: 'test1.png' },
                { base64: testImageBase64, mimeType: 'image/jpeg', filename: 'test2.jpg' }
            ] 
        },
        API_KEY
    );

    console.log('\n=========================================');
    console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
    console.log('=========================================\n');

    await stopMockOpenclaw();

    process.exit(failed > 0 ? 1 : 0);
}

console.log('注意: 请确保 wrong-notebook 服务正在运行\n');

runTests().catch(console.error);
