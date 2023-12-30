import { SlimeSize } from "webgl-test-shared";
import { MovingOrbData, SLIME_MERGE_TIME, SlimeEntityAnger } from "../entities/mobs/slime";

export class SlimeComponent {
   public readonly size: SlimeSize;
   
   public eyeRotation = 2 * Math.PI * Math.random();
   public mergeTimer = SLIME_MERGE_TIME;
   public mergeWeight: number;
   public mergeWant = 0;
   public readonly angeredEntities = new Array<SlimeEntityAnger>();

   public readonly orbs: Array<MovingOrbData>;

   constructor(size: SlimeSize, mergeWeight: number, startingOrbs: Array<MovingOrbData>) {
      this.size = size;
      this.mergeWeight = mergeWeight;
      this.orbs = startingOrbs;
   }
}