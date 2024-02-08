export class TurretComponent {
   public aimDirection = 0;
   public fireCooldownTicks: number;
   public hasTarget = false;

   constructor(fireCooldownTicks: number) {
      this.fireCooldownTicks = fireCooldownTicks;
   }
}