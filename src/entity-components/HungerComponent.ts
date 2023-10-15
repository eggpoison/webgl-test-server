import { SETTINGS } from "webgl-test-shared";
import Component from "./Component";

class HungerComponent extends Component {
   public hunger;
   private readonly metabolism;

   constructor(initialHunger: number, metabolism: number) {
      super();

      this.hunger = initialHunger;
      // @Temporary
      // this.metabolism = metabolism;
      this.metabolism = 100;
   }

   public tick(): void {
      // Udpate hunger
      this.hunger += this.metabolism / SETTINGS.TPS;
      if (this.hunger > 100) {
         this.hunger = 100;
      }
   }
}

export default HungerComponent;