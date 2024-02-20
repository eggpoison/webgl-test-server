import { ID_SENTINEL_VALUE } from "../Entity";

export class ZombieComponent {
   /** The type of the zombie, 0-3 */
   public readonly zombieType: number;
   public readonly tombstoneID: number;

   /** Maps the IDs of entities which have attacked the zombie to the number of ticks that they should remain in the object for */
   public readonly attackingEntityIDs: Record<number, number> = {};

   /** Cooldown before the zombie can do another attack */
   public attackCooldownTicks = 0;

   public visibleHurtEntityID = ID_SENTINEL_VALUE;
   /** Ticks since the visible hurt entity was last hit */
   public visibleHurtEntityTicks = 0;
   
   constructor(zombieType: number, tombstoneID: number) {
      this.zombieType = zombieType;
      this.tombstoneID = tombstoneID;
   }
}