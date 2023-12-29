export class ZombieComponent {
   /** The type of the zombie, 0-3 */
   public readonly zombieType: number;
   public readonly tombstoneID: number;

   // Stores the ids of all entities which have recently attacked the zombie
   public readonly attackingEntityIDs: Record<number, number> = {};

   /** Cooldown before the zombie can do another attack */
   public attackCooldownTicks = 0;
   
   constructor(zombieType: number, tombstoneID: number) {
      this.zombieType = zombieType;
      this.tombstoneID = tombstoneID;
   }
}