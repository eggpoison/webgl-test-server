import { MobAIs, MobInfo, MobType } from "../entities/Mob";

export type MobAICreationInfo = Partial<{ [T in keyof typeof MobAIs]: ConstructorParameters<typeof MobAIs[T]>[1] }>;

type MobData = {
   readonly info: MobInfo;
   readonly aiCreationInfo: MobAICreationInfo;
}

const MOB_AI_DATA_RECORD: Record<MobType, MobData> = {
   cow: {
      info: {
         visionRange: 250
      },
      aiCreationInfo: {
         wander: {
            aiWeightMultiplier: 0.5,
            wanderRate: 0.6,
            acceleration: 100,
            terminalVelocity: 50
         },
         follow: {
            aiWeightMultiplier: 0.75,
            acceleration: 50,
            terminalVelocity: 25,
            minDistanceFromFollowTarget: 150,
            weightBuildupTime: 10,
            interestDuration: 7,
            chanceToGainInterest: 0.2,
            entityTypesToExclude: new Set(["cow"])
         },
         herd: {
            aiWeightMultiplier: 1,
            acceleration: 100,
            terminalVelocity: 50,
            minSeperationDistance: 120,
            turnRate: 0.04,
            maxWeightInflenceCount: 3,
            weightInfluenceFalloff: {
               start: 4,
               duration: 2
            },
            validHerdMembers: new Set(["cow"]),
            seperationWeight: 0.7,
            alignmentWeight: 0.5,
            cohesionWeight: 0.8
         },
         starve: {
            aiWeightMultiplier: 1.25,
            acceleration: 100,
            terminalVelocity: 50,
            metabolism: 1,
            traitVariance: 0.3,
            tileTargets: new Map([
               ["grass", {
                  resultingTileType: "dirt",
                  foodUnits: 100,
                  grazeTime: 5
               }]
            ])
         },
         escape: {
            aiWeightMultiplier: 1.5,
            acceleration: 150,
            terminalVelocity: 100,
            attackSubsideTime: 5
         }
      }
   }
}

export default MOB_AI_DATA_RECORD;