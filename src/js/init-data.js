import { db } from './firebase.js';
import { collection, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const flotte = [
  {
    id: "kangoo-01",
    nom: "Renault Kangoo 01",
    immatriculation: "AA-001-AA",
    type: "VL thermique",
    icone: "🚗",
    checkpoints: {
      "Général": [
        "Documents de bord présents",
        "Propreté intérieure",
        "Rétroviseurs réglés"
      ],
      "Mécanique": [
        "Niveau huile moteur",
        "Niveau liquide refroidissement",
        "Niveau lave-glace"
      ],
      "Sécurité": [
        "Éclairages avant",
        "Éclairages arrière",
        "Pneumatiques (état visuel)",
        "Freins (test à basse vitesse)"
      ]
    }
  },
  {
    id: "goupil-g4-01",
    nom: "Goupil G4 01",
    immatriculation: "AA-002-AA",
    type: "VL électrique",
    icone: "⚡",
    checkpoints: {
      "Général": [
        "Documents de bord présents",
        "Propreté intérieure"
      ],
      "Batterie & Charge": [
        "Niveau de charge batterie",
        "Connecteur de charge (état)",
        "Câble de charge présent"
      ],
      "Sécurité": [
        "Éclairages avant",
        "Éclairages arrière",
        "Pneumatiques (état visuel)",
        "Avertisseur sonore"
      ]
    }
  },
  {
    id: "iveco-daily-01",
    nom: "Iveco Daily 01",
    immatriculation: "AA-003-AA",
    type: "Utilitaire",
    icone: "🚐",
    checkpoints: {
      "Général": [
        "Documents de bord présents",
        "Propreté intérieure",
        "Rétroviseurs réglés"
      ],
      "Mécanique": [
        "Niveau huile moteur",
        "Niveau liquide refroidissement",
        "Niveau lave-glace"
      ],
      "Carrosserie & Chargement": [
        "Portes arrière (fermeture)",
        "Ridelles (état)",
        "Sangles d'arrimage présentes",
        "Plancher (état)"
      ],
      "Sécurité": [
        "Éclairages avant",
        "Éclairages arrière",
        "Gyrophare (si équipé)",
        "Pneumatiques (état visuel)"
      ]
    }
  },
  {
    id: "benne-om-01",
    nom: "Benne OM 01",
    immatriculation: "AA-004-AA",
    type: "Benne ordures ménagères",
    icone: "🗑️",
    checkpoints: {
      "Général": [
        "Documents de bord présents",
        "Rétroviseurs grand angle"
      ],
      "Mécanique PL": [
        "Niveau huile moteur",
        "Niveau liquide refroidissement",
        "Pression circuit pneumatique",
        "Freins (test à basse vitesse)"
      ],
      "Équipement benne": [
        "Mécanisme compacteur",
        "Lève-conteneurs (état)",
        "Hayons (fermeture)",
        "Signalisation arrière"
      ],
      "Sécurité": [
        "Éclairages avant",
        "Éclairages arrière",
        "Gyrophare",
        "Pneumatiques (état visuel)",
        "Marche arrière sonore"
      ]
    }
  },
  {
    id: "balayeuse-01",
    nom: "Balayeuse 01",
    immatriculation: "AA-005-AA",
    type: "Laveuse/Balayeuse VL",
    icone: "🧹",
    checkpoints: {
      "Général": [
        "Documents de bord présents",
        "Rétroviseurs réglés"
      ],
      "Mécanique": [
        "Niveau huile moteur",
        "Niveau liquide refroidissement"
      ],
      "Équipement balayage": [
        "Réservoir eau (niveau)",
        "Réservoir détergent (niveau)",
        "Brosses latérales (état)",
        "Brosse centrale (état)",
        "Buses (état et orientation)",
        "Trémie (vidée et propre)"
      ],
      "Sécurité": [
        "Éclairages avant",
        "Éclairages arrière",
        "Gyrophare",
        "Pneumatiques (état visuel)"
      ]
    }
  }
];

async function initialiserFlotte() {
  console.log('Initialisation de la flotte...');

  for (const vehicule of flotte) {
    const { id, ...data } = vehicule;
    await setDoc(doc(collection(db, 'vehicules'), id), data);
    console.log(`✓ ${vehicule.nom} ajouté`);
  }

  console.log('Flotte initialisée avec succès !');
}

initialiserFlotte();