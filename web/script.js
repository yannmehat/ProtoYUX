var montant = 0;
var credit = 0;

var receiverNum = "";
var receiverName;
var amount;
var amountFlat;
var amountCredit;

var isMuted = 0;


var showInput = 0;


document.addEventListener("loadstart", function(event) {

});

document.addEventListener("DOMContentLoaded", function(event) {



    if(sessionStorage.getItem("isMuted")) {
        isMuted = sessionStorage.getItem("isMuted");
    }
    if(isMuted == 1) {
        document.getElementById("imgMute").src="./assets/mute.png";
        if(document.getElementById("vocal")) {
            document.getElementById("vocal").volume = 0;
        }
    }
    else {
        document.getElementById("imgMute").src="https://media.baamboozle.com/uploads/images/1263646/3b41b5c9-272d-4a4f-a89b-b46b07edfcc3.gif";
        if(document.getElementById("vocal")) {
            document.getElementById("vocal").volume = 1;
        }
    }

    if(sessionStorage.getItem("montant")) {
        montant = sessionStorage.getItem("montant");
    }

    if(sessionStorage.getItem("receiverNum")) {
        receiverNum = sessionStorage.getItem("receiverNum");
    }

    if(sessionStorage.getItem("receiverName")) {
        receiverName = sessionStorage.getItem("receiverName");
    }

    if(sessionStorage.getItem("confAmount")) {
        amountFlat = sessionStorage.getItem("confAmount");
    }
    if(sessionStorage.getItem("confAmountTax")) {
        amount = sessionStorage.getItem("confAmountTax");
    }

    if(sessionStorage.getItem("credit")) {
        credit = sessionStorage.getItem("credit");
    }

    if(sessionStorage.getItem("amountCredit")) {
        amountCredit = sessionStorage.getItem("amountCredit");
    }

    if(sessionStorage.getItem("showInput")) {
        showInput = sessionStorage.getItem("showInput");
    }



    if(showInput == 1 && (document.getElementById("switch"))) {
        switchVisibility();
    }



    if(montant <= 0) {
        montant = 20000;
        sessionStorage.setItem("montant", montant);
    }

    if(credit <= 0) {
        credit = 5000;
        sessionStorage.setItem("credit", credit);
    }

    if(document.getElementById('montant')) {
        document.getElementById('montant').innerHTML = numberWithSpaces(montant) + " CFA";
    }

    if(document.getElementById('confNum')) {
        document.getElementById('confNum').innerHTML = receiverNum;
    }
    if(document.getElementById('confName')) {
        document.getElementById('confName').innerHTML = receiverName;

    }
    if(document.getElementById('confAmountTax')) {
         document.getElementById('confAmountTax').innerHTML = numberWithSpaces(amount) + " CFA";
    }



    if(document.getElementById('confAmount')) {
        document.getElementById('confAmount').innerHTML = numberWithSpaces(amountFlat) + " CFA";
    }

    if(document.getElementById('credit')) {
        document.getElementById('credit').innerHTML = numberWithSpaces(credit) + " CFA<br />crédit";
    }


     if(document.getElementById('inputContactCredit')) {
        if(receiverNum != "undefined" && receiverNum != ""){
            document.getElementById('inputContactCredit').value = receiverNum;
            filterList();

        }
        else {
            document.getElementById('inputContactCredit').value = "667 457 99 22";
            filterList();

        }
    }

     if(document.getElementById('inputContact')) {
        if(receiverNum != "undefined" && receiverNum != ""){
            document.getElementById('inputContact').value = receiverNum;
            filterList();
        }
        else {
            document.getElementById('inputContact').value = "";
            filterList();
        }
    }



     if(document.getElementById('inputCredit')) {
        if(amountCredit != "undefined" && amountCredit != ""){

            document.getElementById('inputCredit').value = amountCredit;

        }
        else {
            document.getElementById('inputCredit').value = "";
        }


    }




     if(document.getElementById('input1')) {
        if(amount != "undefined" && amount != ""){

            document.getElementById('input1').value = amount;

        }
        else {
            document.getElementById('input1').value = "";
        }


    }


     if(document.getElementById('input0')) {
        if(amountFlat != "undefined" && amountFlat != ""){
            document.getElementById('input0').value = amountFlat;
        }
        else {
            document.getElementById('input0').value = "";
        }
    }



    if(document.getElementById('confCredit')) {
        document.getElementById('confCredit').innerHTML = numberWithSpaces(amountCredit) + " CFA";
    }




    if(document.getElementById('inputContact')) {
        document.getElementById('inputContact').value=receiverNum;
        filterList();
    }
});

function isLetter(str) {
   return str.toLowerCase() != str.toUpperCase();
}

function filterList() {
    var input, filt, ul, li, a, div, i, txtValue, numValue, custom;
    if(document.getElementById('inputContactCredit')) {
        input = document.getElementById('inputContactCredit');
    }
    if(document.getElementById('inputContact')) {
        input = document.getElementById('inputContact');
    }
    if(document.getElementById('custom')) {

        document.getElementById('custom').innerHTML = input.value.toUpperCase();
    }

    filt = input.value.toUpperCase();
    filt = filt.replace(/\s/g, '');
    ul = document.getElementById("itemList");
    li = ul.getElementsByTagName('md-list-item');

    for (i = 0; i < li.length; i++) {
      a = li[i].getElementsByTagName("a")[0];
      txtValue = a.textContent || a.innerText;
      txtValue = txtValue.replace(/\s/g, '');


      div = li[i].getElementsByTagName("div")[0];
      numValue = div.textContent || div.innerText;
      numValue = numValue.replace(/\s/g, '');

      // split filter by spaces, gives ["app", "MN"] in your example
      //let filters = filter.split(" ");

      // remove the empty filters (if your filter string
      // starts or ends by a space) since they are source of errors

      // Array.filter takes in parameter a function returning a boolean
      // it create a new array containing only element where
      // the function returned truthy value
      // here we return the length of the string which is falsy (== 0) for ""
      // and truthy for every other string (!= 0)
      //filters = filters.filter(f => f.length);

      let shouldDisplay = true
      // test each filter and store true only if string contains all filter
      //filters.forEach(filt => {
        shouldDisplay = numValue.toUpperCase().includes(filt) || txtValue.toUpperCase().includes(filt)
      //})
      // update visibility
      // set visible if the string include all filters
      // or if there is no filter
      li[i].style.display = shouldDisplay ? "" : "none";
      li[i].nextElementSibling.style.display = shouldDisplay ? "" : "none";
    }

  }

function numberWithSpaces(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function switchMute() {
    if(isMuted==0) {
        isMuted=1;
        sessionStorage.setItem("isMuted", 1);
        document.getElementById("imgMute").src="./assets/mute.png";
        if(document.getElementById("vocal")) {
            document.getElementById("vocal").volume = 0;
        }
    }
    else {
        isMuted=0;
        sessionStorage.setItem("isMuted", 0);
        document.getElementById("imgMute").src="https://media.baamboozle.com/uploads/images/1263646/3b41b5c9-272d-4a4f-a89b-b46b07edfcc3.gif";
        if(document.getElementById("vocal")) {
            document.getElementById("vocal").volume = 1;
            document.getElementById("vocal").play();
        }
    }

}

function setReceiver(name, num) {
    receiverName = name;
    sessionStorage.setItem("receiverName", receiverName);
    receiverNum = num;
    sessionStorage.setItem("receiverNum", receiverNum);


}



function switchVisibility() {
    var target =  document.getElementById("toHide");
    var targetUp = document.getElementById("arrow_up");
    var targetDown = document.getElementById("arrow_down");
    if(target.style.display == "none")
    {
        target.style.display = "";
        targetUp.style.display = "";
        targetDown.style.display = "none";
        showInput=1;
        sessionStorage.setItem("showInput", 1);
    }
    else {
        target.style.display = "none";
        targetUp.style.display = "none";
        targetDown.style.display = "";
        showInput=0;
        sessionStorage.setItem("showInput", 0)
    }
}


function calcAmount(location) {
    var input1 = document.getElementById("input1");
    var input0 = document.getElementById("input0");
    if(location == 1) {
        input0.value = "" + Math.round(Number(input1.value)*0.999);
    } else {
        input1.value = "" + Math.round(Number(input0.value)*1.001);

    }

}

function setAmount() {
    var input1 = document.getElementById("input1");
    var input0 = document.getElementById("input0");
    if(input1.value > 0 && input0.value > 0) {
        amountFlat = input0.value;
        amount = input1.value;
    }
    else {
        amountFlat = 0;
        amount = 0;
    }
        sessionStorage.setItem("confAmountTax", amount);
        sessionStorage.setItem("confAmount", amountFlat);
}

function setCredit() {
    amountCredit = document.getElementById("inputCredit").value;
     if(!amountCredit > 0) {
        amountCredit = 0;
    }
    sessionStorage.setItem("amountCredit", amountCredit);
}

function makeTransfer() {
    if(amount > 0) {
        montant = montant - amount;
        sessionStorage.setItem("montant", montant);
    }
}

function buyCredit() {
    if(amountCredit > 0 && montant > 0) {

    montant = parseInt(montant) - parseInt(amountCredit);
    sessionStorage.setItem("montant", montant);

    if(receiverName == "Ce téléphone") {
        credit = parseInt(credit) + parseInt(amountCredit);
        sessionStorage.setItem("credit", credit);
    }
    }
}

function resetVariables() {

    receiverNum = "";
    receiverName = "";
    amount = "";
    amountFlat = "";
    amountCredit = "";
    showInput = "0";


    sessionStorage.setItem("receiverNum", receiverNum);

    sessionStorage.setItem("receiverName", receiverName);

    sessionStorage.setItem("confAmountTax", amount);

    sessionStorage.setItem("confAmount", amountFlat);

    sessionStorage.setItem("amountCredit", amountCredit);


    sessionStorage.setItem("showInput", showInput);


}
