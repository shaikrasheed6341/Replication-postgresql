import bcrypt from "bcrypt"
import jwt  from "jsonwebtoken";
async function testhash(){
   var password = "shaik";
let privateKey  =  "mani";
   
const paylod = {
  id:1,
  name:"shaik",
  age:12
  
}
  
const result  =await bcrypt.hash(password,10);
     
   
   console.log(result);


    let userenterd = "shaik";
      
      const userenterdhash = await bcrypt.hash(userenterd,10);
       console.log(userenterdhash);
       const result2 =  await bcrypt.compare(password,userenterdhash);
       console.log(result2);
       if(result2 == true){
        const signing = jwt.sign(paylod,privateKey);
        console.log(signing);

            const checkingtoken = jwt.verify(signing,privateKey);
            console.log(checkingtoken);
       } 
  }

  testhash();