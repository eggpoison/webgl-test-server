import { TribeType } from "webgl-test-shared";
import TribeMember from "./entities/tribes/TribeMember";
import TribeHut from "./entities/tribes/TribeHut";
import Tribesman from "./entities/tribes/Tribesman";
import TribeTotem from "./entities/tribes/TribeTotem";

class Tribe {
   public readonly tribeType: TribeType;

   public readonly totem: TribeTotem;
   
   private readonly members = new Array<TribeMember>();

   /** Stores all tribe huts belonging to the tribe */
   private readonly huts = new Array<TribeHut>();

   public tribesmanCap = 0;
   
   constructor(tribeType: TribeType, totem: TribeTotem) {
      this.tribeType = tribeType;
      this.totem = totem;
   }

   public addTribeMember(member: TribeMember): void {
      this.members.push(member);
   }

   public registerNewHut(hut: TribeHut): void {
      this.huts.push(hut);

      // Create a tribesman for the hut
      this.createNewTribesman(hut);
      
      this.tribesmanCap++;
   }

   public removeHut(hut: TribeHut): void {
      const idx = this.huts.indexOf(hut);
      if (idx !== -1) {
         this.huts.splice(idx, 1);
      }
      
      this.tribesmanCap--;
   }

   private createNewTribesman(hut: TribeHut): void {
      const position = hut.position.copy();
      
      const tribesman = new Tribesman(position, false, this, this.tribeType);
      this.members.push(tribesman);

      // Attempt to respawn the tribesman when it is killed
      tribesman.createEvent("death", () => {
         this.respawnTribesman(hut);
      });
   }

   private respawnTribesman(hut: TribeHut): void {
      this.createNewTribesman(hut);
   }

   public getNumHuts(): number {
      return this.huts.length;
   }
}

export default Tribe;