import Component from "./Component";

/*

Damage calculations:


*/

class HealthComponent extends Component {
   private readonly maxHealth: number;

   private health: number;
   private armour: number;

   constructor(maxHealth: number, health: number, armour: number) {
      super();

      this.maxHealth = maxHealth;
      this.health = health;
      this.armour = armour;
   }

   public getHealth(): number {
      return this.health;
   }
}

export default HealthComponent;