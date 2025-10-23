import { Router } from 'express';

const router = Router();

router.get('/mock-contatos', (req, res) => {
  const mockContacts = [
    {
      id: '1',
      nome: 'João Silva',
      telefone: '+55 11 99999-9999',
      email: 'joao@email.com',
      tags: ['cliente', 'vip'],
      observacoes: 'Cliente desde 2020',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    },
    {
      id: '2',
      nome: 'Maria Santos',
      telefone: '+55 11 88888-8888',
      email: 'maria@email.com',
      tags: ['fornecedor'],
      observacoes: 'Fornecedor de materiais',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    },
    {
      id: '3',
      nome: 'Pedro Oliveira',
      telefone: '+55 11 77777-7777',
      email: 'pedro@email.com',
      tags: ['cliente'],
      observacoes: null,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    }
  ];

  res.json({
    contacts: mockContacts,
    total: mockContacts.length,
    page: 1,
    pageSize: 10,
    totalPages: 1
  });
});

export { router as mockRoutes };