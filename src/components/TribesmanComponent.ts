import { TribesmanAIType } from "../entities/tribes/tribesman";

export class TribesmanComponent {
   /** ID of the hut which spawned the tribesman */
   public readonly hutID: number;

   public lastAIType = TribesmanAIType.idle;
   
   public targetPatrolPositionX = -1;
   public targetPatrolPositionY = -1;

   constructor(hutID: number) {
      this.hutID = hutID;
   }
}