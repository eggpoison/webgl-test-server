import { RiverSteppingStoneData } from "webgl-test-shared";
import Entity from "./GameObject";

class Chunk {
   /** Stores all game objects inside the chunk */
   public readonly gameObjects = new Array<Entity>();
   
   public readonly entities = new Set<Entity>();
   public readonly droppedItems = new Set<Entity>();
   public readonly projectiles = new Set<Entity>();

   /** Stores all mobs which have the chunk in their vision range */
   public readonly viewingMobs = new Array<Entity>();

   public readonly riverSteppingStones = new Array<RiverSteppingStoneData>();

   public readonly x: number;
   public readonly y: number;

   constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
   }
}

export default Chunk;