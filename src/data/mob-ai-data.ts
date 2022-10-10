import { MobAIs, MobInfo, MobType } from "../entities/Mob";

export type MobAICreationInfo = Partial<{ [T in keyof typeof MobAIs]: ConstructorParameters<typeof MobAIs[T]>[1] }>;

type MobData = {
   readonly info: MobInfo;
   readonly aiCreationInfo: MobAICreationInfo;
}

const MOB_AI_DATA_RECORD: Record<MobType, MobData> = {
   cow: {
      info: {
         visionRange: 200
      },
      aiCreationInfo: {
         wander: {
            aiWeightMultiplier: 1,
            wanderRate: 0.6,
            acceleration: 100,
            terminalVelocity: 50
         },
         follow: {
            aiWeightMultiplier: 1,
            maxDistance: 100
         },
         herd: { 
            aiWeightMultiplier: 1,
            minSeperationDistance: 120,
            turnRate: 0.2,
            validHerdMembers: new Set(["cow"])
         },
         graze: {
            aiWeightMultiplier: 1,
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
            aiWeightMultiplier: 1,
            acceleration: 150,
            terminalVelocity: 100
         }
      }
   }
}

export default MOB_AI_DATA_RECORD;