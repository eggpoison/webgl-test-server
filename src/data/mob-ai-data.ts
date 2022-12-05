import { MobType, SETTINGS } from "webgl-test-shared";
import { MobAIs, MobInfo } from "../entities/Mob";

export type MobAICreationInfo = Partial<{ [T in keyof typeof MobAIs]: ConstructorParameters<typeof MobAIs[T]>[1] }>;

type MobAIData = {
   readonly info: MobInfo;
   readonly aiCreationInfo: MobAICreationInfo;
}

const MOB_AI_DATA_RECORD: Record<MobType, MobAIData> = {
   cow: {
      info: {
         visionRange: SETTINGS.TILE_SIZE * 4
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
            minSeperationDistance: 150,
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
   },
   zombie: {
      info: {
         visionRange: SETTINGS.TILE_SIZE * 5
      },
      aiCreationInfo: {
         wander: {
            aiWeightMultiplier: 0.5,
            wanderRate: 0.4,
            acceleration: 100,
            terminalVelocity: 50
         },
         herd: {
            aiWeightMultiplier: 0.8,
            acceleration: 100,
            terminalVelocity: 50,
            minSeperationDistance: 50,
            turnRate: 0.05,
            maxWeightInflenceCount: 3,
            weightInfluenceFalloff: {
               start: 6,
               duration: 3
            },
            validHerdMembers: new Set(["zombie"]),
            seperationWeight: 0.4,
            alignmentWeight: 0.5,
            cohesionWeight: 0.8
         },
         chase: {
            aiWeightMultiplier: 1,
            acceleration: 200,
            terminalVelocity: 100,
            targetEntityTypes: new Set(["player"])
         }
      }
   }
}

export default MOB_AI_DATA_RECORD;