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
            aiWeightMultiplier: 1,
            acceleration: 50,
            terminalVelocity: 25,
            minDistanceFromFollowTarget: 150,
            weightBuildupTime: 10,
            interestDuration: 7,
            chanceToGainInterest: 0.2,
            entityTypesToExclude: new Set(["cow"])
         },
         herd: {
            aiWeightMultiplier: 0,
            minSeperationDistance: 120,
            turnRate: 0.2,
            validHerdMembers: new Set(["cow"])
         },
         graze: {
            aiWeightMultiplier: 0,
            stomachCapacity: 100,
            metabolism: 1,
            tileTargets: new Set([
               {
                  targetTileType: "grass",
                  resultingTileType: "dirt",
                  foodUnits: 100,
                  digestTime: 5
               }
            ])
         },
         escape: {
            aiWeightMultiplier: 0,
            acceleration: 150,
            terminalVelocity: 100
         }
      }
   }
}

export default MOB_AI_DATA_RECORD;