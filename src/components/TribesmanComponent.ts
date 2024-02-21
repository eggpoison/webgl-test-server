import { ID_SENTINEL_VALUE } from "../Entity";

export enum TribesmanAIType {
   escaping,
   attacking,
   harvestingResources,
   pickingUpDroppedItems,
   haulingResources,
   grabbingFood,
   patrolling,
   idle
}

export class TribesmanComponent {
   /** ID of the hut which spawned the tribesman */
   public readonly hutID: number;

   /** ID of the current entity being hunted by the tribesman */
   public huntedEntityID = ID_SENTINEL_VALUE;

   public lastAIType = TribesmanAIType.idle;
   
   public targetPatrolPositionX = -1;
   public targetPatrolPositionY = -1;

   // @Memory @Speed: This is only used to clear the ResearchBenchComponent's preemptiveOccupeeID value when
   // the tribesmen finishes researching, is there some better way which doesn't need having this value?
   public targetResearchBenchID = ID_SENTINEL_VALUE;

   constructor(hutID: number) {
      this.hutID = hutID;
   }
}