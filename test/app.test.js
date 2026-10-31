const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');
const { PRODUCT_CATALOG } = require('../src/catalog');
const { createSqliteRepository } = require('../src/db/sqlite');

const EXPECTED_CATALOG = [
  ['Mochila Arquiteto Azure', 'Mochila premium para profissionais de Cloud, Azure e arquitetura.', 249.9, '/products/mochila_tech_azure_arquiteto.png'],
  ['Caneca Mentoria Arquiteto Azure', 'Caneca exclusiva da Mentoria Arquiteto Azure.', 79.9, '/products/caneca_preta_mentoria_arquiteto_azure.png'],
  ['Caneca Pós-Graduação Arquitetura de Azure com AI', 'Caneca exclusiva da Pós-Graduação Arquitetura de Azure com AI.', 79.9, '/products/caneca_azure_ai_pós_graduação_em_azul_neon.png'],
  ['Caderno Pós-Graduação Arquitetura de Azure com AI', 'Caderno premium para projetos, diagramas, estudos e Arquiteturas Azure com AI.', 54.9, '/products/caderno_azure_com_ai_e_caneta_premium.png'],
  ['Camiseta Azure Expert', 'Camiseta exclusiva Azure Expert para profissionais que vivem Cloud e Azure.', 119.9, '/products/camiseta_azure_expert_tech.png'],
  ['Camiseta Mentoria Arquiteto Azure', 'Camiseta exclusiva da Mentoria Arquiteto Azure.', 119.9, '/products/mockup_de_camiseta_arquiteto_azure.png'],
  ['Camiseta Pós-Graduação Arquitetura de Azure com AI', 'Camiseta exclusiva da Pós-Graduação Arquitetura de Azure com AI.', 119.9, '/products/camiseta_tech_azure_com_design_futurista.png'],
  ['Camiseta Microsoft Certified Expert', 'Camiseta Microsoft Certified Expert.', 119.9, '/products/Camiseta_Microsoft_Certified_Expert.png']
];

function repository() {
  return { provider: 'test', async health(){ return true; }, async listProducts(){ return [{ id: 1, name: 'Caderno AI', price: 10, stock: 3 }]; }, async createOrder(){ return { id: 42, total: 10, status: 'Recebido' }; } };
}
async function withServer(fn) { const server = createApp(repository()).listen(0); await once(server, 'listening'); try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); } }
async function withOrderServer(fn) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'azure-shop-api-'));
  const repository = createSqliteRepository(path.join(directory, 'loja.db'));
  const server = createApp(repository).listen(0);
  await once(server, 'listening');
  try { await fn(`http://127.0.0.1:${server.address().port}`, repository); } finally {
    server.close();
    await repository.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
test('health informa o estado da aplicação', () => withServer(async (url) => { const res = await fetch(`${url}/api/health`); assert.equal(res.status, 200); assert.equal((await res.json()).status, 'ok'); }));
test('catálogo retorna produtos', () => withServer(async (url) => { const res = await fetch(`${url}/api/products`); assert.equal((await res.json())[0].name, 'Caderno AI'); }));
test('pedido inválido é rejeitado', () => withServer(async (url) => { const res = await fetch(`${url}/api/orders`, { method:'POST', headers:{'content-type':'application/json'}, body:'{}' }); assert.equal(res.status, 400); }));
test('pedido válido é criado', () => withServer(async (url) => { const res = await fetch(`${url}/api/orders`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({customerName:'Aluno',customerEmail:'aluno@example.com',customerSessionId:'11111111-1111-4111-8111-111111111111',paymentMethod:'pix',cep:'01310-100',couponCode:'arquitetoazure10',items:[{productId:1,quantity:1}]}) }); assert.equal(res.status, 201); assert.equal((await res.json()).id, 42); }));
test('pedido rejeita CEP ou cupom inválido', () => withServer(async (url) => {
  const baseOrder = { customerName:'Aluno', customerEmail:'aluno@example.com', customerSessionId:'11111111-1111-4111-8111-111111111111', paymentMethod:'pix', items:[{productId:1,quantity:1}] };
  const invalidCep = await fetch(`${url}/api/orders`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ ...baseOrder, cep:'123' }) });
  assert.equal(invalidCep.status, 400);
  const invalidCoupon = await fetch(`${url}/api/orders`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ ...baseOrder, cep:'01310-100', couponCode:'CUPOMINVALIDO' }) });
  assert.equal(invalidCoupon.status, 400);
}));
test('catálogo oficial contém exatamente oito produtos com imagens locais', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'azure-shop-'));
  const repository = createSqliteRepository(path.join(directory, 'loja.db'));
  try {
    const products = await repository.listProducts();
    assert.equal(products.length, 8);
    assert.deepEqual(
      products.map((product) => [product.name, product.description, product.price, product.image]),
      EXPECTED_CATALOG
    );
    assert.deepEqual(
      PRODUCT_CATALOG.map((product) => [product.name, product.description, product.price, product.image]),
      EXPECTED_CATALOG
    );
  } finally {
    await repository.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test('imagens do catálogo são servidas sem 404', () => withServer(async (url) => {
  for (const product of PRODUCT_CATALOG) {
    const response = await fetch(`${url}${product.image}`);
    assert.equal(response.status, 200, product.image);
    assert.match(response.headers.get('content-type'), /^image\/png/);
  }
}));

test('pedido persiste subtotal, desconto e frete calculados no servidor', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'azure-shop-order-'));
  const repository = createSqliteRepository(path.join(directory, 'loja.db'));
  try {
    const [product] = await repository.listProducts();
    const order = await repository.createOrder({
      customerName: 'Aluno',
      customerEmail: 'aluno@example.com',
      customerSessionId: '11111111-1111-4111-8111-111111111111',
      paymentMethod: 'pix',
      cep: '01310100',
      couponCode: 'arquitetoazureexpert30',
      items: [{ productId: product.id, quantity: 2 }]
    });
    assert.equal(order.id, 1);
    assert.match(order.orderNumber, /^AZS-\d{8}-001$/);
    assert.equal(order.subtotal, 499.8);
    assert.equal(order.discount, 149.94);
    assert.equal(order.shipping, 13.9);
    assert.equal(order.couponCode, 'ARQUITETOAZUREEXPERT30');
    assert.deepEqual(order.payment, { method: 'pix', status: 'pending', amount: 363.76, paidAt: null });
    assert.equal(order.total, 363.76);
    assert.equal(order.status, 'pending');
    assert.equal((await repository.getProduct(product.id)).stock, product.stock - 2);
  } finally {
    await repository.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('histórico e detalhe de pedidos são persistidos e isolados por sessão', () => withOrderServer(async (url) => {
  const session = '11111111-1111-4111-8111-111111111111';
  const otherSession = '22222222-2222-4222-8222-222222222222';
  const products = await (await fetch(`${url}/api/products`)).json();
  const created = await fetch(`${url}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Aluno',
      customerEmail: 'aluno@example.com',
      customerSessionId: session,
      paymentMethod: 'credit_card',
      cep: '01310-100',
      couponCode: 'ARQUITETURAAZUREAI20',
      items: [{ productId: products[0].id, quantity: 1 }]
    })
  });
  assert.equal(created.status, 201);
  const order = await created.json();
  assert.match(order.orderNumber, /^AZS-\d{8}-001$/);
  const list = await fetch(`${url}/api/orders`, { headers: { 'x-customer-session-id': session } });
  assert.equal(list.status, 200);
  const orders = await list.json();
  assert.equal(orders.length, 1);
  assert.equal(orders[0].payment.status, 'pending');
  assert.equal(orders[0].shipping.amount, 13.9);
  const search = await fetch(`${url}/api/orders?search=${order.orderNumber}`, { headers: { 'x-customer-session-id': session } });
  assert.equal((await search.json()).length, 1);
  const filtered = await fetch(`${url}/api/orders?status=pending`, { headers: { 'x-customer-session-id': session } });
  assert.equal((await filtered.json()).length, 1);
  const detail = await fetch(`${url}/api/orders/${order.orderNumber}`, { headers: { 'x-customer-session-id': session } });
  assert.equal(detail.status, 200);
  const detailOrder = await detail.json();
  assert.equal(detailOrder.items[0].name, products[0].name);
  assert.equal(detailOrder.items[0].unitPrice, products[0].price);
  assert.equal(detailOrder.history[0].description, 'Pedido criado');
  assert.equal(detailOrder.invoice.status, 'processing');
  const ordersPage = await fetch(`${url}/orders`);
  assert.equal(ordersPage.status, 200);
  assert.match(await ordersPage.text(), /id="orders-page"/);
  const detailPage = await fetch(`${url}/orders/${order.orderNumber}`);
  assert.equal(detailPage.status, 200);
  const forbidden = await fetch(`${url}/api/orders/${order.orderNumber}`, { headers: { 'x-customer-session-id': otherSession } });
  assert.equal(forbidden.status, 404);
  const noSession = await fetch(`${url}/api/orders`);
  assert.equal(noSession.status, 401);
}));

test('health retorna 503 quando o banco está indisponível', async () => {
  const failing = { ...repository(), async health() { throw new Error('indisponível'); } };
  const server = createApp(failing).listen(0);
  await once(server, 'listening');
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { status: 'unhealthy' });
  } finally { server.close(); }
});

const CONFIG_ENV_KEYS = ['PORT', 'DB_PROVIDER', 'AZURE_SQL_AUTH', 'AZURE_SQL_SERVER', 'AZURE_SQL_DATABASE', 'AZURE_SQL_USER', 'AZURE_SQL_PASSWORD'];
// Carrega a configuração em processo isolado, a partir de pasta vazia, para que um .env local não interfira.
function loadConfig(overrides) {
  const env = { ...process.env };
  for (const key of CONFIG_ENV_KEYS) delete env[key];
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'azure-shop-config-'));
  try {
    return spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.resolve(__dirname, '../src/config.js'))})`], { cwd, env: { ...env, ...overrides }, encoding: 'utf8' });
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
}

test('configuração aceita valores padrão e configurações válidas do App Service', () => {
  assert.equal(loadConfig({}).status, 0);
  assert.equal(loadConfig({ PORT: '8080' }).status, 0);
  assert.equal(loadConfig({ DB_PROVIDER: 'sqlserver', AZURE_SQL_AUTH: 'managedIdentity', AZURE_SQL_SERVER: 'example.invalid', AZURE_SQL_DATABASE: 'example' }).status, 0);
});

test('configuração inválida interrompe o início sem expor o valor recebido', () => {
  const cases = [
    [{ DB_PROVIDER: 'valor-invalido-xyz' }, 'DB_PROVIDER'],
    [{ PORT: 'valor-invalido-xyz' }, 'PORT'],
    [{ PORT: '70000' }, 'PORT'],
    [{ DB_PROVIDER: 'sqlserver', AZURE_SQL_AUTH: 'valor-invalido-xyz', AZURE_SQL_SERVER: 'example.invalid', AZURE_SQL_DATABASE: 'example' }, 'AZURE_SQL_AUTH']
  ];
  for (const [overrides, name] of cases) {
    const result = loadConfig(overrides);
    assert.notEqual(result.status, 0, name);
    assert.match(result.stderr, new RegExp(`Configuração inválida: ${name}`));
    assert.doesNotMatch(result.stderr, /valor-invalido-xyz|70000/);
  }
});
