import { SlimeSize } from "webgl-test-shared";
import { SLIME_MERGE_TIME, SlimeEntityAnger } from "../entities/mobs/slime";
import Board from "../Board";

export class SlimeComponent {
   public readonly size: SlimeSize;

   public lastSpitTicks: number;
   public spitChargeProgress = 0;
   
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
      this.lastSpitTicks = Board.ticks;
      this.lastMergeTicks = Board.ticks;
   }
}