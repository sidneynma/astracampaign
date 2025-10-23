const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function searchCampaign() {
  try {
    console.log('Buscando todas as campanhas...');
    const allCampaigns = await prisma.campaign.findMany({
      select: {
        id: true,
        nome: true,
        status: true,
        criadoEm: true
      },
      orderBy: {
        criadoEm: 'desc'
      },
      take: 10
    });

    console.log('Últimas 10 campanhas:', allCampaigns.map(c => ({ nome: c.nome, status: c.status })));

    // Verificar mensagens da campanha
    const campaignMessages = await prisma.campaignMessage.findMany({
      where: {
        campaign: {
          nome: {
            contains: 'bbbb',
            mode: 'insensitive'
          }
        }
      },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        selectedVariation: true,
        campaignId: true,
        contactPhone: true,
        campaign: {
          select: {
            nome: true,
            status: true,
            messageContent: true
          }
        }
      },
      take: 5
    });

    console.log('Mensagens da campanha bbbb:', JSON.stringify(campaignMessages, null, 2));

    const campaigns = await prisma.campaign.findMany({
      where: {
        nome: {
          contains: 'bbbb',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        nome: true,
        status: true,
        messageContent: true,
        criadoEm: true
      }
    });

    console.log('Campanhas encontradas:', JSON.stringify(campaigns, null, 2));

    if (campaigns.length > 0) {
      const campaign = campaigns[0];
      let messageContent;

      try {
        messageContent = JSON.parse(campaign.messageContent);
        console.log('\nMessageContent parsed:', JSON.stringify(messageContent, null, 2));

        // Verificar se há variações nos itens da sequência
        messageContent.sequence?.forEach((item, index) => {
          console.log(`\nSequence item ${index}:`, item.type);
          if (item.content?.mediaVariations) {
            console.log('Has mediaVariations:', item.content.mediaVariations.length);
            item.content.mediaVariations.forEach((variation, varIndex) => {
              console.log(`Variation ${varIndex}: URL="${variation.url}", Caption="${variation.caption}"`);
            });
          }
        });
      } catch (e) {
        console.error('Erro ao fazer parse do messageContent:', e);
        console.log('Raw messageContent:', campaign.messageContent);
      }
    }

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

searchCampaign();