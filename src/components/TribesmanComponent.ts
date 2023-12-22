export class TribesmanComponent {
   /** ID of the hut which spawned the tribesman */
   public readonly hutID: number;
   
   public targetPatrolPositionX = -1;
   public targetPatrolPositionY = -1;

   constructor(hutID: number) {
      this.hutID = hutID;
   }
}