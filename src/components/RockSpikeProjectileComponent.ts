export class RockSpikeProjectileComponent {
   public readonly size: number;
   public readonly lifetimeTicks: number;
   public readonly frozenYetiID: number;

   constructor(size: number, lifetimeTicks: number, frozenYetiID: number) {
      this.size = size;
      this.lifetimeTicks = lifetimeTicks;
      this.frozenYetiID = frozenYetiID;
   }
}