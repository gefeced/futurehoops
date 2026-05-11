window.FutureHoops = window.FutureHoops || {};

window.FutureHoops.plays = (() => {
  const plays = [
    {
      name: "Pick & Roll",
      primary: "Roll Man",
      secondary: "Corner Shooter",
      shotTypes: ["layup", "three"],
      openBonus: 0.08,
      turnoverRisk: 0.04,
      fatigueCost: 5,
      primarySpot: [0.55, 0.76],
      secondarySpot: [0.2, 0.36],
      routes: [
        {
          role: "ball",
          color: "rgba(57, 246, 255, 0.7)",
          points: [
            [0.5, 0.2],
            [0.58, 0.32],
            [0.62, 0.45]
          ]
        },
        {
          role: "screener",
          color: "rgba(141, 91, 255, 0.6)",
          points: [
            [0.6, 0.46],
            [0.54, 0.4],
            [0.55, 0.72]
          ]
        },
        {
          role: "corner",
          color: "rgba(76, 255, 154, 0.5)",
          points: [
            [0.18, 0.28],
            [0.2, 0.36]
          ]
        }
      ]
    },
    {
      name: "Isolation",
      primary: "Ball Handler",
      secondary: "Kick-Out",
      shotTypes: ["mid", "three"],
      openBonus: 0.03,
      turnoverRisk: 0.06,
      fatigueCost: 4,
      primarySpot: [0.54, 0.46],
      secondarySpot: [0.78, 0.3],
      routes: [
        {
          role: "ball",
          color: "rgba(57, 246, 255, 0.7)",
          points: [
            [0.52, 0.26],
            [0.58, 0.36],
            [0.54, 0.46]
          ]
        }
      ]
    },
    {
      name: "Off-Ball Screen",
      primary: "Shooter",
      secondary: "Slip",
      shotTypes: ["three", "mid"],
      openBonus: 0.07,
      turnoverRisk: 0.03,
      fatigueCost: 4,
      primarySpot: [0.72, 0.26],
      secondarySpot: [0.5, 0.58],
      routes: [
        {
          role: "shooter",
          color: "rgba(57, 246, 255, 0.7)",
          points: [
            [0.2, 0.26],
            [0.44, 0.28],
            [0.72, 0.26]
          ]
        },
        {
          role: "screener",
          color: "rgba(141, 91, 255, 0.6)",
          points: [
            [0.5, 0.52],
            [0.52, 0.62]
          ]
        }
      ]
    },
    {
      name: "Corner Flare",
      primary: "Corner Shooter",
      secondary: "Wing",
      shotTypes: ["three", "mid"],
      openBonus: 0.09,
      turnoverRisk: 0.04,
      fatigueCost: 4,
      primarySpot: [0.18, 0.32],
      secondarySpot: [0.68, 0.36],
      routes: [
        {
          role: "flare",
          color: "rgba(57, 246, 255, 0.7)",
          points: [
            [0.44, 0.58],
            [0.28, 0.44],
            [0.18, 0.32]
          ]
        },
        {
          role: "wing",
          color: "rgba(141, 91, 255, 0.6)",
          points: [
            [0.68, 0.42],
            [0.68, 0.36]
          ]
        }
      ]
    },
    {
      name: "Backdoor Cut",
      primary: "Cutter",
      secondary: "Lift",
      shotTypes: ["layup", "mid"],
      openBonus: 0.1,
      turnoverRisk: 0.05,
      fatigueCost: 5,
      primarySpot: [0.5, 0.8],
      secondarySpot: [0.62, 0.3],
      routes: [
        {
          role: "cutter",
          color: "rgba(57, 246, 255, 0.7)",
          points: [
            [0.68, 0.3],
            [0.58, 0.5],
            [0.5, 0.76]
          ]
        },
        {
          role: "lift",
          color: "rgba(141, 91, 255, 0.6)",
          points: [
            [0.3, 0.44],
            [0.22, 0.3]
          ]
        }
      ]
    }
  ];

  const reactions = [
    { name: "Switch", contestBoost: 0.04, difficultyDelta: 5, turnoverBoost: 0.03 },
    { name: "Hedge", contestBoost: 0.06, difficultyDelta: 8, turnoverBoost: 0.04 },
    { name: "Drop", contestBoost: -0.05, difficultyDelta: -4, turnoverBoost: 0.01 },
    { name: "Trap", contestBoost: 0.1, difficultyDelta: 10, turnoverBoost: 0.06 }
  ];

  function getPlayNames() {
    return plays.map((play) => play.name);
  }

  function getPlay(name) {
    return plays.find((play) => play.name === name);
  }

  function rollDefenseReaction() {
    const reaction = reactions[Math.floor(Math.random() * reactions.length)];
    return reaction;
  }

  function runPlay(playName) {
    const play = getPlay(playName) || plays[0];
    if (!play) {
      return null;
    }
    const reaction = rollDefenseReaction();
    const primaryShotType = play.shotTypes[0];
    const secondaryShotType = play.shotTypes[1] || play.shotTypes[0];

    return {
      play,
      reaction,
      primaryOption: {
        label: play.primary,
        shotType: primaryShotType,
        spot: play.primarySpot
      },
      secondaryOption: {
        label: play.secondary,
        shotType: secondaryShotType,
        spot: play.secondarySpot
      }
    };
  }

  return {
    plays,
    getPlayNames,
    runPlay
  };
})();
