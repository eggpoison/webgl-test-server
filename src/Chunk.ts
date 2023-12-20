import { RiverSteppingStoneData } from "webgl-test-shared";
import Entity from "./GameObject";

class Chunk {
   /** Stores all game objects inside the chunk */
   public readonly entities = new Array<Entity>();

   /** Stores all mobs which have the chunk in their vision range */
   // @Incomplete
   // public readonly viewingMobs = new Array<Entity>();

   public readonly riverSteppingStones = new Array<RiverSteppingStoneData>();

   public readonly x: number;
   public readonly y: number;

   constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
   }
}

export default Chunk;