import { BODY_GENERATION_RADIUS } from "../entities/mobs/golem";
import Hitbox from "../hitboxes/Hitbox";

export interface RockInfo {
   readonly sleepOffsetX: number;
   readonly sleepOffsetY: number;
   readonly awakeOffsetX: number;
   readonly awakeOffsetY: number;
}

const generateRockInfoRecord = (hitboxes: ReadonlyArray<Hitbox>): Record<number, RockInfo> => {
   const rockInfoRecord: Record<number, RockInfo> = {};
   
   for (let i = 0; i < hitboxes.length; i++) {
      const hitbox = hitboxes[i];

      const offsetMagnitude = BODY_GENERATION_RADIUS * Math.random()
      const offsetDirection = 2 * Math.PI * Math.random();

      rockInfoRecord[hitbox.localID] = {
         sleepOffsetX: offsetMagnitude * Math.sin(offsetDirection),
         sleepOffsetY: offsetMagnitude * Math.cos(offsetDirection),
         awakeOffsetX: hitbox.offset.x,
         awakeOffsetY: hitbox.offset.y
      };
   }
   
   return rockInfoRecord;
}

export interface GolemTargetInfo {
   damageDealtToSelf: number;
   timeSinceLastAggro: number;
}

export class GolemComponent {
   public readonly rockInfoRecord: Record<number, RockInfo>;
   public readonly attackingEntities: Record<number, GolemTargetInfo> = {};
   public wakeTimerTicks = 0;
   
   constructor(hitboxes: ReadonlyArray<Hitbox>) {
      this.rockInfoRecord = generateRockInfoRecord(hitboxes);
   }
}