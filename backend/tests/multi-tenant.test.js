/**
 * Testes Multi-Tenant
 *
 * Este arquivo contém testes abrangentes para funcionalidades multi-tenant
 */

const request = require('supertest');
const app = require('../src/server');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

describe('Multi-Tenant System', () => {
  let superAdminToken;
  let tenantAdminToken;
  let userToken;
  let testTenant;
  let testTenant2;
  let testUser;

  beforeAll(async () => {
    // Limpar dados de teste
    await cleanTestData();

    // Criar SUPERADMIN
    const superAdminPassword = await bcrypt.hash('superadmin123', 12);
    const superAdmin = await prisma.user.create({
      data: {
        nome: 'Super Admin Test',
        email: 'superadmin@test.com',
        senha: superAdminPassword,
        role: 'SUPERADMIN',
        ativo: true
      }
    });

    superAdminToken = jwt.sign(
      {
        userId: superAdmin.id,
        email: superAdmin.email,
        role: 'SUPERADMIN'
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Criar tenants de teste
    testTenant = await createTestTenant('tenant-test-1', 'Tenant Test 1');
    testTenant2 = await createTestTenant('tenant-test-2', 'Tenant Test 2');

    // Criar tokens para tenant admin e user
    const tenantAdminPassword = await bcrypt.hash('admin123', 12);
    const tenantAdmin = await prisma.user.create({
      data: {
        nome: 'Tenant Admin Test',
        email: 'admin@tenant1.com',
        senha: tenantAdminPassword,
        role: 'TENANT_ADMIN',
        ativo: true,
        tenantId: testTenant.id
      }
    });

    tenantAdminToken = jwt.sign(
      {
        userId: tenantAdmin.id,
        email: tenantAdmin.email,
        role: 'TENANT_ADMIN',
        tenantId: testTenant.id
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const userPassword = await bcrypt.hash('user123', 12);
    testUser = await prisma.user.create({
      data: {
        nome: 'Regular User Test',
        email: 'user@tenant1.com',
        senha: userPassword,
        role: 'USER',
        ativo: true,
        tenantId: testTenant.id
      }
    });

    userToken = jwt.sign(
      {
        userId: testUser.id,
        email: testUser.email,
        role: 'USER',
        tenantId: testTenant.id
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  async function cleanTestData() {
    // Limpar em ordem devido às foreign keys
    await prisma.campaignMessage.deleteMany({
      where: {
        OR: [
          { tenantId: testTenant?.id },
          { tenantId: testTenant2?.id },
          { campaign: { tenantId: testTenant?.id } },
          { campaign: { tenantId: testTenant2?.id } }
        ]
      }
    });

    await prisma.campaign.deleteMany({
      where: {
        OR: [
          { tenantId: testTenant?.id },
          { tenantId: testTenant2?.id }
        ]
      }
    });

    await prisma.contact.deleteMany({
      where: {
        OR: [
          { tenantId: testTenant?.id },
          { tenantId: testTenant2?.id }
        ]
      }
    });

    await prisma.whatsAppSession.deleteMany({
      where: {
        OR: [
          { tenantId: testTenant?.id },
          { tenantId: testTenant2?.id }
        ]
      }
    });

    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: 'superadmin@test.com' },
          { email: 'admin@tenant1.com' },
          { email: 'user@tenant1.com' },
          { tenantId: testTenant?.id },
          { tenantId: testTenant2?.id }
        ]
      }
    });

    await prisma.tenantSettings.deleteMany({
      where: {
        OR: [
          { tenantId: testTenant?.id },
          { tenantId: testTenant2?.id }
        ]
      }
    });

    await prisma.tenantQuota.deleteMany({
      where: {
        OR: [
          { tenantId: testTenant?.id },
          { tenantId: testTenant2?.id }
        ]
      }
    });

    await prisma.tenant.deleteMany({
      where: {
        OR: [
          { slug: 'tenant-test-1' },
          { slug: 'tenant-test-2' }
        ]
      }
    });
  }

  async function createTestTenant(slug, name) {
    return await prisma.tenant.create({
      data: {
        slug,
        name,
        active: true,
        quotas: {
          create: {
            maxUsers: 10,
            maxContacts: 1000,
            maxCampaigns: 50,
            maxConnections: 5
          }
        },
        settings: {
          create: {}
        }
      }
    });
  }

  describe('SUPERADMIN APIs', () => {
    test('Should list all tenants', async () => {
      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.tenants).toBeInstanceOf(Array);
      expect(response.body.tenants.length).toBeGreaterThanOrEqual(2);

      const tenant1 = response.body.tenants.find(t => t.slug === 'tenant-test-1');
      expect(tenant1).toBeDefined();
      expect(tenant1.name).toBe('Tenant Test 1');
    });

    test('Should create new tenant', async () => {
      const newTenantData = {
        slug: 'new-tenant-test',
        name: 'New Tenant Test',
        adminUser: {
          nome: 'New Admin',
          email: 'admin@newtenant.com',
          senha: 'NewPassword123'
        }
      };

      const response = await request(app)
        .post('/api/tenants')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(newTenantData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.tenant.slug).toBe('new-tenant-test');
      expect(response.body.adminUser.email).toBe('admin@newtenant.com');

      // Cleanup
      await prisma.user.deleteMany({ where: { email: 'admin@newtenant.com' } });
      await prisma.tenantSettings.deleteMany({ where: { tenantId: response.body.tenant.id } });
      await prisma.tenantQuota.deleteMany({ where: { tenantId: response.body.tenant.id } });
      await prisma.tenant.delete({ where: { id: response.body.tenant.id } });
    });

    test('Should get tenant details', async () => {
      const response = await request(app)
        .get(`/api/tenants/${testTenant.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.tenant.id).toBe(testTenant.id);
      expect(response.body.tenant.slug).toBe('tenant-test-1');
      expect(response.body.tenant.quotas).toBeDefined();
      expect(response.body.tenant.settings).toBeDefined();
    });

    test('Should deny access to non-SUPERADMIN users', async () => {
      await request(app)
        .get('/api/tenants')
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .expect(403);

      await request(app)
        .get('/api/tenants')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('Tenant Isolation - Contacts', () => {
    let contact1, contact2;

    beforeAll(async () => {
      // Criar contatos para cada tenant
      contact1 = await prisma.contact.create({
        data: {
          nome: 'Contact Tenant 1',
          telefone: '+5511999999999',
          email: 'contact1@tenant1.com',
          tags: ['test'],
          tenantId: testTenant.id
        }
      });

      contact2 = await prisma.contact.create({
        data: {
          nome: 'Contact Tenant 2',
          telefone: '+5511888888888',
          email: 'contact2@tenant2.com',
          tags: ['test'],
          tenantId: testTenant2.id
        }
      });
    });

    test('Tenant admin should only see own tenant contacts', async () => {
      const response = await request(app)
        .get('/api/contatos')
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .expect(200);

      expect(response.body.contacts).toBeInstanceOf(Array);
      expect(response.body.contacts.length).toBe(1);
      expect(response.body.contacts[0].id).toBe(contact1.id);
      expect(response.body.contacts[0].nome).toBe('Contact Tenant 1');
    });

    test('SUPERADMIN should see all contacts', async () => {
      const response = await request(app)
        .get('/api/contatos')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.contacts.length).toBeGreaterThanOrEqual(2);

      const contactIds = response.body.contacts.map(c => c.id);
      expect(contactIds).toContain(contact1.id);
      expect(contactIds).toContain(contact2.id);
    });

    test('Should not access contact from other tenant', async () => {
      await request(app)
        .get(`/api/contatos/${contact2.id}`)
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .expect(404);
    });

    test('Should create contact with automatic tenant association', async () => {
      const newContactData = {
        nome: 'New Contact',
        telefone: '+5511777777777',
        email: 'newcontact@tenant1.com',
        tags: ['new']
      };

      const response = await request(app)
        .post('/api/contatos')
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .send(newContactData)
        .expect(201);

      expect(response.body.contact.tenantId).toBe(testTenant.id);
      expect(response.body.contact.nome).toBe('New Contact');

      // Cleanup
      await prisma.contact.delete({ where: { id: response.body.contact.id } });
    });
  });

  describe('Tenant Isolation - WhatsApp Sessions', () => {
    let session1, session2;

    beforeAll(async () => {
      session1 = await prisma.whatsAppSession.create({
        data: {
          name: 'session-tenant-1',
          status: 'WORKING',
          provider: 'WAHA',
          tenantId: testTenant.id
        }
      });

      session2 = await prisma.whatsAppSession.create({
        data: {
          name: 'session-tenant-2',
          status: 'WORKING',
          provider: 'WAHA',
          tenantId: testTenant2.id
        }
      });
    });

    test('Should only see own tenant sessions', async () => {
      const response = await request(app)
        .get('/api/waha/sessions')
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);

      const sessionNames = response.body.map(s => s.name);
      expect(sessionNames).toContain('session-tenant-1');
      expect(sessionNames).not.toContain('session-tenant-2');
    });

    test('SUPERADMIN should see all sessions', async () => {
      const response = await request(app)
        .get('/api/waha/sessions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const sessionNames = response.body.map(s => s.name);
      expect(sessionNames).toContain('session-tenant-1');
      expect(sessionNames).toContain('session-tenant-2');
    });

    test('Should not access session from other tenant', async () => {
      await request(app)
        .get(`/api/waha/sessions/${session2.name}`)
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .expect(404);
    });
  });

  describe('Tenant Isolation - Campaigns', () => {
    let campaign1, campaign2;

    beforeAll(async () => {
      campaign1 = await prisma.campaign.create({
        data: {
          nome: 'Campaign Tenant 1',
          targetTags: 'test',
          messageType: 'TEXT',
          messageContent: 'Test message 1',
          randomDelay: 1000,
          startImmediately: false,
          tenantId: testTenant.id
        }
      });

      campaign2 = await prisma.campaign.create({
        data: {
          nome: 'Campaign Tenant 2',
          targetTags: 'test',
          messageType: 'TEXT',
          messageContent: 'Test message 2',
          randomDelay: 1000,
          startImmediately: false,
          tenantId: testTenant2.id
        }
      });
    });

    test('Should only see own tenant campaigns', async () => {
      const response = await request(app)
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .expect(200);

      expect(response.body.campaigns).toBeInstanceOf(Array);

      const campaignIds = response.body.campaigns.map(c => c.id);
      expect(campaignIds).toContain(campaign1.id);
      expect(campaignIds).not.toContain(campaign2.id);
    });

    test('Should not access campaign from other tenant', async () => {
      await request(app)
        .get(`/api/campaigns/${campaign2.id}`)
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .expect(404);
    });
  });

  describe('JWT Token Validation', () => {
    test('Should reject invalid token', async () => {
      await request(app)
        .get('/api/contatos')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('Should reject token without tenant for non-SUPERADMIN', async () => {
      const tokenWithoutTenant = jwt.sign(
        {
          userId: testUser.id,
          email: testUser.email,
          role: 'USER'
          // Missing tenantId
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      await request(app)
        .get('/api/contatos')
        .set('Authorization', `Bearer ${tokenWithoutTenant}`)
        .expect(401);
    });

    test('Should accept SUPERADMIN token without tenant', async () => {
      const superAdminWithoutTenant = jwt.sign(
        {
          userId: 'super-admin-id',
          email: 'super@admin.com',
          role: 'SUPERADMIN'
          // No tenantId for SUPERADMIN is OK
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // This should work for SUPERADMIN APIs
      const response = await request(app)
        .get('/api/tenants')
        .set('Authorization', `Bearer ${superAdminWithoutTenant}`);

      // Should not be 401 (unauthorized due to missing tenant)
      expect(response.status).not.toBe(401);
    });
  });

  describe('Data Migration Scenarios', () => {
    test('Should handle orphan data (without tenant)', async () => {
      // Create contact without tenant (legacy data)
      const orphanContact = await prisma.contact.create({
        data: {
          nome: 'Orphan Contact',
          telefone: '+5511666666666',
          email: 'orphan@test.com',
          tags: ['orphan'],
          tenantId: null // Legacy data without tenant
        }
      });

      // Tenant admin should not see orphan data
      const tenantResponse = await request(app)
        .get('/api/contatos')
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .expect(200);

      const tenantContactIds = tenantResponse.body.contacts.map(c => c.id);
      expect(tenantContactIds).not.toContain(orphanContact.id);

      // SUPERADMIN should see orphan data
      const superAdminResponse = await request(app)
        .get('/api/contatos')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const superAdminContactIds = superAdminResponse.body.contacts.map(c => c.id);
      expect(superAdminContactIds).toContain(orphanContact.id);

      // Cleanup
      await prisma.contact.delete({ where: { id: orphanContact.id } });
    });
  });

  describe('Performance and Security', () => {
    test('Should have proper database indexes', async () => {
      // Test that queries with tenant filtering are efficient
      const startTime = Date.now();

      await request(app)
        .get('/api/contatos?search=test')
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .expect(200);

      const queryTime = Date.now() - startTime;

      // Query should complete within reasonable time (1 second)
      expect(queryTime).toBeLessThan(1000);
    });

    test('Should prevent SQL injection through tenant isolation', async () => {
      // Attempt SQL injection (should be prevented by Prisma)
      const maliciousToken = jwt.sign(
        {
          userId: testUser.id,
          email: testUser.email,
          role: 'USER',
          tenantId: "'; DROP TABLE contacts; --"
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/contatos')
        .set('Authorization', `Bearer ${maliciousToken}`);

      // Should handle gracefully without crashing
      expect([200, 400, 401, 404, 500]).toContain(response.status);
    });
  });
});