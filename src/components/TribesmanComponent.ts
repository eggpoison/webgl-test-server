import { ID_SENTINEL_VALUE } from "../Entity";
import { TribesmanAIType } from "../entities/tribes/tribe-worker";

export class TribesmanComponent {
   /** ID of the hut which spawned the tribesman */
   public readonly hutID: number;

   /** ID of the current entity being hunted by the tribesman */
   public huntedEntityID = ID_SENTINEL_VALUE;

   public lastAIType = TribesmanAIType.idle;
   
   public targetPatrolPositionX = -1;
   public targetPatrolPositionY = -1;

   constructor(hutID: number) {
      this.hutID = hutID;
   }
}