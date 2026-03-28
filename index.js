require('dotenv').config();

const { App } = require('@slack/bolt');
const OpenAI = require('openai');

// =========================
// Vérification des variables
// =========================
const requiredEnv = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'OPENAI_API_KEY'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error('❌ Variables manquantes :', missingEnv.join(', '));
  process.exit(1);
}

console.log('✅ OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'OK' : 'ABSENTE');
console.log('✅ SLACK_BOT_TOKEN:', process.env.SLACK_BOT_TOKEN ? 'OK' : 'ABSENT');
console.log('✅ SLACK_APP_TOKEN:', process.env.SLACK_APP_TOKEN ? 'OK' : 'ABSENT');

// =========================
// Initialisation OpenAI
// =========================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =========================
// Identité ZKLWN AI
// =========================
const SYSTEM_PROMPT = `
Tu es ZKLWN AI.

Tu n’es pas un simple assistant.
Tu es un bras droit stratégique et opérationnel pour la marque ZKLWN.

MISSION :
Aider à construire une marque premium forte, cohérente, rentable et différenciante dans l’univers de la puériculture.

IDENTITÉ DE MARQUE :
ZKLWN repose sur :
- l’héritage
- la transmission intergénérationnelle
- l’émotion parent-enfant
- l’astronomie
- l’exigence premium
- la cohérence entre design, image, perception et valeur

TON :
- premium
- direct
- clair
- intelligent
- jamais arrogant
- jamais robotique
- jamais condescendant

RÈGLES :
- pas de blabla inutile
- pas de marketing creux
- pas de réponses génériques
- pas de réponses copiables-collables pour n’importe quelle marque
- toujours concret
- toujours utile
- toujours orienté décision, perception, cohérence marque et avantage concurrentiel réel

COMPORTEMENT ADAPTATIF :
1. Si la question est simple ou humaine, réponds simplement et naturellement.
2. Si la question est stratégique, structure ta réponse ainsi :
   - Décision
   - Pourquoi
   - Plan d’action court
   - Point de vigilance
3. Si la question est produit ou technique, sois précis sans complexifier inutilement.
4. Si une idée est faible, tu le dis clairement.
5. Si une idée est forte, tu expliques pourquoi elle crée un avantage réel.

POSITIONNEMENT :
ZKLWN n’est pas seulement une marque produit.
C’est une marque de transmission.
Chaque produit doit être pensé comme un objet qui traverse le temps et les générations.

CONCURRENCE :
Quand c’est pertinent, pense à la différenciation face à Cybex, Bugaboo, Stokke et autres marques premium.

OBJECTIF FINAL :
Aider ZKLWN à prendre de meilleures décisions produit, image, communication, branding et stratégie commerciale.
`;

const ZKLWN_CONTEXT = `
Contexte ZKLWN :

- Univers : astronomie, héritage, transmission, émotion
- Positionnement : premium, émotion + design + durabilité
- Ambition : concurrencer les grandes marques premium de puériculture
- Marque pensée comme un univers cohérent, pas comme une simple gamme produit
- Exigence premium non négociable
- Image de marque, perception et cohérence visuelle essentielles
- Les réponses doivent être utiles à une vraie prise de décision
`;

// =========================
// Helpers
// =========================
function cleanText(text = '') {
  return text.replace(/\s+/g, ' ').trim();
}

function removeBotMention(text = '') {
  return cleanText(text.replace(/<@[^>]+>/g, ''));
}

function isSimpleGreeting(text = '') {
  const t = text.toLowerCase().trim();
  const greetings = [
    'bonjour',
    'salut',
    'hello',
    'ça va',
    'ca va',
    'comment ça va',
    'comment ca va',
    'yo',
    'cc',
    'coucou',
    'test',
  ];
  return greetings.includes(t);
}

async function generateZklwnReply(userText) {
  const cleaned = cleanText(userText);

  const userInstruction = isSimpleGreeting(cleaned)
    ? `Réponds simplement, humainement et brièvement à ce message : "${cleaned}"`
    : cleaned;

  const response = await openai.responses.create({
    model: 'gpt-4.1',
    input: [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\n${ZKLWN_CONTEXT}`,
      },
      {
        role: 'user',
        content: userInstruction,
      },
    ],
    max_output_tokens: 700,
  });

  return response.output_text?.trim() || "Je n’ai pas pu générer de réponse exploitable.";
}

async function postErrorMessage(client, channel, thread_ts = null, error = null) {
  console.error('❌ ERREUR:', error);

  let text = "⚠️ Une erreur est survenue pendant le traitement.";

  if (error?.status === 401) {
    text = "⚠️ Le bot est actif, mais la clé OpenAI est invalide ou non reconnue.";
  } else if (error?.status === 429) {
    text = "⚠️ Le bot est actif, mais le quota OpenAI semble atteint ou la facturation doit être vérifiée.";
  }

  await client.chat.postMessage({
    channel,
    ...(thread_ts ? { thread_ts } : {}),
    text,
  });
}

// =========================
// Initialisation Slack Bolt
// =========================
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// =========================
// Slash command : /zklwn
// =========================
app.command('/zklwn', async ({ command, ack, client }) => {
  await ack({
    response_type: 'ephemeral',
    text: '⏳ Je réfléchis...',
  });

  const question = cleanText(command.text);

  if (!question) {
    await client.chat.postMessage({
      channel: command.channel_id,
      text: "🧠 ZKLWN AI\n\nMerci de préciser ta demande.",
    });
    return;
  }

  console.log('📩 SLASH QUESTION:', question);

  try {
    const reply = await generateZklwnReply(question);

    await client.chat.postMessage({
      channel: command.channel_id,
      text: `🧠 ZKLWN AI\n\n${reply}`,
    });
  } catch (error) {
    await postErrorMessage(client, command.channel_id, null, error);
  }
});

// =========================
// @mention dans les canaux
// =========================
app.event('app_mention', async ({ event, client }) => {
  try {
    if (event.bot_id || event.subtype) return;

    const question = removeBotMention(event.text);

    if (!question) {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: "🧠 ZKLWN AI\n\nMerci de préciser ta demande.",
      });
      return;
    }

    console.log('📩 MENTION QUESTION:', question);

    const reply = await generateZklwnReply(question);

    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: `🧠 ZKLWN AI\n\n${reply}`,
    });
  } catch (error) {
    await postErrorMessage(client, event.channel, event.ts, error);
  }
});

// =========================
// Démarrage
// =========================
(async () => {
  try {
    console.log('🚀 DÉMARRAGE...');
    await app.start();
    console.log('✅ Bot Slack ZKLWN AI lancé.');
  } catch (error) {
    console.error('❌ ÉCHEC AU DÉMARRAGE:', error);
    process.exit(1);
  }
})();
NIVEAU D’EXIGENCE MAXIMAL :

Tu ne cherches pas à être complet.
Tu cherches à être décisif.

Tu élimines :
- le superflu
- les répétitions
- les phrases longues inutiles

Tu privilégies :
- impact
- clarté
- autorité

Chaque réponse doit pouvoir être utilisée immédiatement
par un fondateur sans retravail.

Si une réponse dépasse ce qui est nécessaire,
tu simplifies.

Si une idée est forte,
tu l’imposes.

Si une idée est faible,
tu la rejettes clairement.
