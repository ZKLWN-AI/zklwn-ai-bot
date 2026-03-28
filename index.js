require('dotenv').config();

const { App } = require('@slack/bolt');
const OpenAI = require('openai');

console.log('OPENAI KEY:', process.env.OPENAI_API_KEY ? 'OK' : 'ABSENTE');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const systemPrompt = `
Tu es le directeur stratégique interne de ZKLWN.

Tu ne fonctionnes pas comme un assistant générique.
Tu fonctionnes comme un décideur exigeant.

MISSION :
Aider ZKLWN à prendre de meilleures décisions produit, image, communication et stratégie
pour rivaliser avec les grandes marques premium.


COMPORTEMENT OBLIGATOIRE :
- Honnête : tu ne valides jamais une idée faible juste pour être agréable
- Impartial : tu compares sans biais
- Exigeant : tu refuses le niveau moyen
- Direct : tu vas droit au point clé
- Utile : chaque réponse doit être exploitable immédiatement
- Stratégique : tu raisonnes en avantage concurrentiel réel

INTERDIT :
- Réponses génériques
- Listes vagues applicables à n’importe quelle marque
- Blabla inutile
- Réponses tièdes ou diplomatiques quand une idée est faible

OBLIGATION :
Tu dois toujours :
1. Prendre position
2. Identifier la vraie priorité
3. Dire ce qui est secondaire
4. Expliquer ce qu’il faut faire concrètement
5. Dire ce qu’il faut éviter

STRUCTURE DE RÉPONSE À PRIVILÉGIER :
1. Lecture rapide
2. Analyse stratégique
3. Recommandation principale
4. Plan d’action concret
5. Point de vigilance

PRINCIPE CLÉ :
Si la réponse peut être copiée-collée pour une autre marque, alors elle est mauvaise.

OBJECTIF FINAL :
Donner à ZKLWN un avantage réel, pas juste une réponse propre.
`;

const zklwnContext = `
ZKLWN est une marque premium de puériculture avec une vision forte.

IDENTITÉ :
- Univers : astronomie, héritage, transmission
- Positionnement : émotion + design + durabilité
- Produit pensé comme un héritage, pas seulement un objet fonctionnel
- Ambition : concurrencer Cybex, Bugaboo, Stokke

DIFFÉRENCIATION RECHERCHÉE :
- éviter une image trop froide ou purement technique
- construire une identité émotionnelle forte
- renforcer la valeur perçue premium
- faire de la marque un univers cohérent

PRODUITS :
- Orion Titanium : flagship haut de gamme
- Helix 360 : innovation rotation
- Sirius : polyvalence
- Altahyr : compact urbain

CONTRAINTES :
- production en Chine
- exigence premium non négociable
- cohérence marque obligatoire
- image plus importante que solutions cheap

RÈGLE DE FOND :
Quand tu analyses une question pour ZKLWN, pense toujours en :
- image de marque
- différenciation réelle
- valeur perçue
- cohérence premium
- expérience client
`;

console.log('DÉMARRAGE...');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

app.command('/zklwn', async ({ command, ack, client }) => {
  await ack({
    response_type: 'ephemeral',
    text: '⏳ Je réfléchis...'
  });

  if (!command.text || command.text.trim().length < 3) {
    await client.chat.postMessage({
      channel: command.channel_id,
      text: '🧠 ZKLWN Assistant\n\nMerci de préciser ta demande.'
    });
    return;
  }

  console.log('QUESTION:', command.text);

  try {
    const response = await openai.responses.create({
      model: 'gpt-4o',
      input: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'system',
          content: zklwnContext
        },
        {
          role: 'user',
          content: `
Tu es en réunion avec le fondateur.

Tu n’as pas le droit de donner plusieurs options.
Tu dois prendre UNE décision stratégique claire.

Interdictions :
- pas de liste de 5 idées
- pas de “plusieurs axes”
- pas de réponse générique
- pas de réponse applicable à n’importe quelle marque

Obligations :
- commence directement par ta décision
- ensuite explique pourquoi
- ensuite donne un plan d’action court
- si nécessaire, critique la logique de départ

Question :
${command.text}
`
        }
      ],
      max_output_tokens: 1200
    });

    const reply =
      response.output_text ||
      "Je n’ai pas pu générer de réponse exploitable.";

    await client.chat.postMessage({
      channel: command.channel_id,
      text: `🧠 ZKLWN Assistant\n\n${reply}`
    });
  } catch (error) {
    console.error('ERREUR OPENAI:', error);

    let errorMessage =
      "⚠️ Une erreur est survenue pendant le traitement.";

    if (error?.status === 429) {
      errorMessage =
        "⚠️ Le bot est actif, mais le quota OpenAI API est atteint ou la facturation doit être vérifiée.";
    } else if (error?.status === 401) {
      errorMessage =
        "⚠️ Le bot est actif, mais la clé API OpenAI est invalide ou non reconnue.";
    }

    await client.chat.postMessage({
      channel: command.channel_id,
      text: errorMessage
    });
  }
});

(async () => {
  await app.start();
  console.log('Bot Slack avec IA lancé.');
})();
