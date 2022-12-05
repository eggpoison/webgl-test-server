import { CowSpecies, Point } from "webgl-test-shared";
import Entity from "./Entity";

class Tombstone extends Entity {
   private readonly tombstoneType: number;
   
   constructor(position: Point) {
      super(position, "tombstone", {

      });

      this.tombstoneType = Math.floor(Math.random() * 1);

      this.setIsStatic(true);

      // Make the tombstone appear to face up from the client's perspective
      this.rotation = Math.PI / 2;
   }

   public getClientArgs(): [tombstoneType: number] {
      return [this.tombstoneType];
   }
}

export default Tombstone;