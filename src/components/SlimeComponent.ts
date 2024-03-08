import { SlimeComponentData, SlimeSize } from "webgl-test-shared";
import { SLIME_MERGE_TIME, SPIT_CHARGE_TIME_TICKS, SPIT_COOLDOWN_TICKS, SlimeEntityAnger } from "../entities/mobs/slime";
import Board from "../Board";
import { SlimeComponentArray } from "./ComponentArray";
import Entity from "../Entity";

export class SlimeComponent {
   public readonly size: SlimeSize;

   /** The last tick that the slime spat at */
   public lastSpitTicks = 0;
   /** Progress in charging the spit attack in ticks */
   public spitChargeTicks = 0;
   
   public eyeRotation = 2 * Math.PI * Math.random();
   public mergeTimer = SLIME_MERGE_TIME;
   public mergeWeight: number;
   public lastMergeTicks: number;
   public readonly angeredEntities = new Array<SlimeEntityAnger>();

   public orbSizes: Array<SlimeSize>;

   constructor(size: SlimeSize, mergeWeight: number, orbSizes: Array<SlimeSize>) {
      this.size = size;
      this.mergeWeight = mergeWeight;
      this.orbSizes = orbSizes;
      this.lastMergeTicks = Board.ticks;
   }
}

export function serialiseSlimeComponent(slime: Entity): SlimeComponentData {
   const slimeComponent = SlimeComponentArray.getComponent(slime.id);

   let anger = -1;
   if (slimeComponent.angeredEntities.length > 0) {
      // Find maximum anger
      for (const angerInfo of slimeComponent.angeredEntities) {
         if (angerInfo.angerAmount > anger) {
            anger = angerInfo.angerAmount;
         }
      }
   }

   const spitChargeProgress = slimeComponent.spitChargeTicks >= SPIT_COOLDOWN_TICKS ? (slimeComponent.spitChargeTicks - SPIT_COOLDOWN_TICKS) / (SPIT_CHARGE_TIME_TICKS - SPIT_COOLDOWN_TICKS) : -1;

   return {
      size: slimeComponent.size,
      eyeRotation: slimeComponent.eyeRotation,
      orbSizes: slimeComponent.orbSizes,
      anger: anger,
      spitChargeProgress: spitChargeProgress
   };
}