const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');


const Imap = require('node-imap');
const { simpleParser } = require('mailparser');

const {inspect} = require('util');

puppeteer.use(StealthPlugin());

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}


function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radio de la tierra en metros
    const toRad = (angle) => (angle * Math.PI) / 180;
  
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
  
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
    const C = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    let m = R * C;
    return m.toFixed(2);
}


function calcularPromedioTiempo(tiempos) {
    if (!tiempos || tiempos.length < 1 || tiempos.length > 10) {
      return "Error: Debe proporcionar entre 1 y 10 strings.";
    }
  
    const diasTranscurridos =[];
  
    for (const tiempo of tiempos) {
      const tiempoLower = tiempo.toLowerCase();
      if (tiempoLower === 'hoy') {
        diasTranscurridos.push(0);
      } else if (tiempoLower === '1 día') {
        diasTranscurridos.push(1);
      } else if (tiempoLower.endsWith(' días')) {
        const numDias = parseInt(tiempo.split(' ')[0]);
        if (!isNaN(numDias) && numDias > 0) {
          diasTranscurridos.push(numDias);
        }
      } else if (tiempoLower === '1 mes') {
        diasTranscurridos.push(30); // Aproximación de 1 mes a 30 días
      } else if (tiempoLower.endsWith(' meses')) {
        const numMeses = parseInt(tiempo.split(' ')[0]);
        if (!isNaN(numMeses) && numMeses > 0) {
          diasTranscurridos.push(numMeses * 30); // Aproximación de cada mes a 30 días
        } else if (tiempoLower.endsWith(' minuto') || tiempoLower.endsWith(' minutos') || tiempoLower.endsWith(' hora') || tiempoLower.endsWith(' horas')) {
          diasTranscurridos.push(0); // Considerar minutos y horas como "Hoy"
        }
      }
    }
  
    if (diasTranscurridos.length === 0) {
      return "No se proporcionaron tiempos válidos.";
    }
  
    // Ordenar el array para calcular la mediana
    diasTranscurridos.sort((a, b) => a - b);
  
    const mitad = Math.floor(diasTranscurridos.length / 2);
  
    let mediana;
    if (diasTranscurridos.length % 2 === 0) {
      // Si la longitud es par, la mediana es el promedio de los dos elementos centrales
      mediana = (diasTranscurridos[mitad - 1] + diasTranscurridos[mitad]) / 2;
    } else {
      // Si la longitud es impar, la mediana es el elemento central
      mediana = diasTranscurridos[mitad];
    }
  
    if (mediana === 0) {
      return "Hoy";
    } else {
      return `Hace ${Math.round(mediana)} días`;
    }
  }

const readlinePromises = require('readline/promises');

const rl = readlinePromises.createInterface({
  input: process.stdin,
  output: process.stdout,
});

(async (req, res) => {
    //scrapping

    const imap = new Imap({
        user: 'scrap2025scrap@gmail.com',
        password: 'izlnoodgdvynzukv',
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
    });
    
    // Configuración de filtros
    const senderEmail = 'noresponder@idealista.com'; // Reemplaza con el correo del remitente
    const hoursAgo = 24; // Rango de búsqueda en horas
    
    imap.once('ready', () => {
        console.log('Conexión IMAP lista');
        imap.openBox('INBOX', true, (err, box) => {
            if (err) throw err;
    
            console.log(`Bandeja de entrada abierta (${box.messages.total} mensajes)`);
            
            const searchDate = new Date();
            searchDate.setHours(searchDate.getHours() - hoursAgo);
    
            // Buscar correos filtrados
            imap.search([
                ['FROM', senderEmail],
                ['SINCE', searchDate.toISOString().split('T')[0]]
            ], async (err, results) => {
                if (err) throw err;
    
                if (results.length === 0) {
                    console.log('No se encontraron correos.');
                    return imap.end();
                }
    
                console.log(`\nEncontrados ${results.length} correos. Procesando...`);
    
                const fetch = imap.fetch(results, {
                    bodies: '', // Obtener el contenido completo
                    markSeen: false // No marcar como leído
                });
    
                fetch.on('message', (msg) => {
                    let buffer = '';
    
                    msg.on('body', (stream) => {
                        stream.on('data', (chunk) => {
                            buffer += chunk.toString('utf8');
                        });
    
                        stream.once('end', async () => {
                            try {
                                // Parsear el correo con mailparser
                                const parsed = await simpleParser(buffer);
                                if(parsed.subject.includes('Asturias') || parsed.subject.includes('barcelona')){
                                console.log('\n════════════════════════════════════');
                                console.log(`📧 De: ${parsed.from?.text} | Asunto: ${parsed.subject}`);
                                console.log(`📅 Fecha: ${parsed.date}`);
    
                                // Extraer enlaces del cuerpo del correo
                                if (parsed.text || parsed.html) {
                                    const textToSearch = parsed.text || parsed.html;
                                    const linkss = extractLinks(textToSearch);
                                    let links = []

                                    for(let link of linkss){
                                        if(link.includes('https://www.idealista.com/inmueble/')){
                                            links.push(link)
                                        }
                                    }
                                    
                                    if (links.length > 0) {
                                        console.log('\n🔗 Enlaces encontrados:');
                                        links.forEach((link, i) => console.log(`${i + 1}. ${link}`));
                                    } else {
                                        console.log('No se encontraron enlaces.');
                                    }
                                }
                            }else{
                                console.log(parsed.subject);
                            }
                            } catch (error) {
                                console.error('Error al parsear el correo:', error);
                            }
                        });
                    });
    
                    msg.on('attributes', (attrs) => {
                        console.log(`📌 UID del mensaje: ${attrs.uid}`);
                    });
                });
    
                fetch.once('error', (err) => {
                    console.error('Error al descargar mensajes:', err);
                });
    
                fetch.once('end', () => {
                    console.log('\n✅ Procesamiento completado.');
                    imap.end();
                });
            });
        });
    });
    
    // Función para extraer enlaces usando expresiones regulares
    function extractLinks(text) {
        const linkRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
        const links = text.match(linkRegex) || [];
        return [...new Set(links)]; // Eliminar duplicados
    }
    
    // Manejo de errores
    imap.once('error', (err) => {
        console.error('Error en la conexión IMAP:', err);
    });
    
    imap.once('end', () => {
        console.log('Conexión IMAP cerrada.');
    });
    
    imap.connect();
    
    let celda
    let entidad
    let ciudad
    let nestudent
    let TipoEnt
    let agr
    let coords
    let Promediotiempo
    let CosteMedio

    const allInfo = [];
    let timeer = 0
    let dataHab = {}
    let proxyURL = 'gw.dataimpulse.com:823';
    let password = '67e4b118d2a4651a';
    let username = '10461ca1d2a9c33bcb99';
    let radioo
    let radio
    let zoom
        
async function tuFuncion() {
    try {
        do{            
            radioo = await rl.question('Ingresa el radio de busqueda: ');
            radio = parseInt(radioo)
            console.log(`El tamaño del Radio ingresado es: ${radio}`);

            if (radioo <= 1000) {
                zoom = 15;
            } else if (radioo >= 1001 && radioo <= 2000) {
                zoom = 14;
            } else if (radioo >= 2001 && radioo <= 3000) {
                zoom = 13;
            } else if (radioo >= 3001 && radioo <= 5000) {
                zoom = 12;
            }

            if(radioo < 200 || radioo > 5000){
                console.log('El radioo debe estar entre 200 y 5000 metros');
            }
        }while(radioo < 200 || radioo > 5000)

    } catch (err) {
        console.error('Error:', err);
    } finally {
        rl.close();
    }
}
  
    await tuFuncion();

    setInterval(() => {
        timeer = timeer + .5
    }, 500);

    let MotherCoords
    let Link
    let listLink

    try{


        const XLSX = require('xlsx');

const workbook = XLSX.readFile('./input/input.xlsx'); // Reemplaza 'tu-archivo.xlsx'
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const valoresColumnaC = []; // Array para guardar los valores

// Obtener el rango de la hoja de cálculo
const range = XLSX.utils.decode_range(sheet['!ref']);

// Iterar a través de las filas de la columna C
for (let fila = range.s.r; ; fila++) { // Bucle infinito hasta encontrar una celda vacía
     let direccionCelda = 'C' + (fila + 2); // C1, C2, C3, ... (filas en Excel empiezan en 1)
     let Entidad = 'A' + (fila + 2); // C1, C2, C3, ... (filas en Excel empiezan en 1)
     let Ciudad = 'B' + (fila + 2); // C1, C2, C3, ... (filas en Excel empiezan en 1)
     let NEstudaintesAprox = 'D' + (fila + 2); // C1, C2, C3, ... (filas en Excel empiezan en 1)
     let TipoEntidad = 'E' + (fila + 2); // C1, C2, C3, ... (filas en Excel empiezan en 1)
     let Agrupacion = 'F' + (fila + 2); // C1, C2, C3, ... (filas en Excel empiezan en 1)
    celda = sheet[direccionCelda];
    entidad = sheet[Entidad];
    ciudad = sheet[Ciudad];
    nestudent = sheet[NEstudaintesAprox];
    TipoEnt = sheet[TipoEntidad];
    agr = sheet[Agrupacion];

    if (celda && celda.v) {
        let objetoInfo = {
            link : celda.v,
            entidad  : entidad.v ,
            ciudad : ciudad.v,
            nestudent :nestudent.v ,
            TipoEnt : TipoEnt.v,
            agr : agr.v,
        }        // Si la celda existe y tiene un valor, lo agregamos al array
        valoresColumnaC.push(objetoInfo);
    } else {
        // Si la celda está vacía, terminamos el bucle
        break;
    }
}

console.log(valoresColumnaC, '-------'); // Mostrar los valores de la columna C
let allRoundInfo = [] 
for(let linkMaps of valoresColumnaC){
    allRoundInfo = [] 
    let HabAll = [];
    let solodate = [];
    let habArray = [];
    let enradio = 0;
    let linkk = linkMaps.link;
    MotherCoords = linkk.split('place/')[1];
    console.log(MotherCoords,'--------');
    let doneCoords = MotherCoords.replace(',','/');
    Link = `https://www.idealista.com/point/venta-viviendas/${doneCoords}/${zoom}/mapa-google`; 

    let browser = await puppeteer.launch({
        headless: true,
        args: [`--proxy-server=${proxyURL}`]
    });

    let page = await browser.newPage();
    await page.authenticate({ username, password });    
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (resourceType == 'document' || resourceType == 'script'  || resourceType == 'xhr' || resourceType == 'fetch' ) {
            request.continue();
        } else {
            //console.log(request.url(),' : ', request.resourceType());
            request.continue();
            //request.abort();
        }
    });

    let status
    do{

        if(page.isClosed()){
            console.log('page is closed due status 403, reopeing page');
            browser = await puppeteer.launch({
            headless: true,
            args: [`--proxy-server=${proxyURL}`]
            });
        
            page = await browser.newPage();
            await page.authenticate({ username, password });
        
            await page.setRequestInterception(true);

            page.on('request', (request) => {
            const resourceType = request.resourceType();
            if (resourceType == 'document'){
                request.continue();
            } else {
                request.continue()
                //request.abort()
            } })
        };  
        const maxRetries = 3;
        let retries = 0;
        let check;
        
        while (retries < maxRetries) {
          try {
            await delay(1000)   // Wait a bit due to race 
            check = await page.goto(Link, { waitUntil: 'load', timeout: 0 });
            console.log('Navigation successful');
            break; // Exit the loop if navigation is successful
          } catch (error) {
            if (error.message.includes('Navigating frame was detached')) {
              console.error(`Retry ${retries + 1}: Frame Detached Error - ${error.message}`);
              retries++;
            } else if (error.message.includes('net::ERR_TIMED_OUT')) {
              console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
              retries++;
            } else if (error.message.includes('net::ERR_CONNECTION_CLOSED')) {
                console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                retries++;
            } else if (error.message.includes('net::ERR_CONNECTION_RESET')) {
                console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                retries++;
            } else if (error.message.includes('net::ERR_PROXY_CONNECTION_FAILED')) {
                console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                retries++;
            } else if (error.message.includes('net::ERR_CERT_AUTHORITY_INVALID')) {
                console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                retries++;
            } else {
              console.error(`Unexpected error: ${error.message}`);
              throw error; // Throw other unexpected errors
            }
          }
        }
        
        if (retries === maxRetries) {
          console.error('Failed to navigate after maximum retry attempts');
          // Optionally handle the error gracefully to keep the code running
        }
        
        // Proceed with the rest of your code
        
        
        // Proceed with the rest of your code
        let intentos = 0;
        const maxIntentos = 3; // Define un número máximo de intentos para evitar bucles infinitos
        
        while (intentos < maxIntentos) {
            try {
                status = await check.status();
                break; // Si la ejecución tiene éxito, salimos del bucle
            } catch (error) {
                if (error instanceof TypeError && error.message.includes("Cannot read properties of null (reading 'status')")) {
                    console.log(`Error al obtener el estado. Intentando de nuevo (${intentos + 1}/${maxIntentos})...`);
                    intentos++;
                    // Puedes agregar un pequeño retraso aquí si es necesario
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                } else {
                    // Si es otro tipo de error, lánzalo para que se maneje en otro lugar
                    throw error;
                }
            }
        }
        
        if (status === undefined) {
            console.error("No se pudo obtener el estado después de varios intentos.");
            // Maneja el caso en el que no se pudo obtener el estado después de varios intentos
        } else {
          // Aquí puedes continuar con el resto de tu código que depende de 'status'
          console.log("Estado obtenido:", status);
        }        if (status == 200 ) {
            
            await page.waitForSelector('a#listing-view-button', {timeout: 0});
            listLink = await page.evaluate(() => {
                return document.querySelector('a#listing-view-button').href;
            });

            console.log('-------')
            console.log('-------');
            console.log(listLink);
            
            console.log('-------')
            console.log('-------')
        } else {
            console.log(`Página no accesible: ${Link} (Status: ${status})`);
            await page.close();
            await browser.close()
        }
    }while(status != 200 || listLink.includes('mapa-google'))
        await browser.close();
    solodate = []
        
    try{
        let statuss
        
        let browser = await puppeteer.launch({
            headless: true,
            args: [`--proxy-server=${proxyURL}`]
        });
        
        let page = await browser.newPage();
        await page.authenticate({ username, password });    
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            if (resourceType == 'document' ) {
                request.continue();
            } else {
                //console.log(request.url(),' : ', request.resourceType());
                //request.continue();
                request.abort();
            }
        });
                do{
        
                ///-----------------------------------------///
        
                if(page.isClosed()){
                    console.log('page is closed due status 403, reopeing page');
                    browser = await puppeteer.launch({
                    headless: true,
                    args: [`--proxy-server=${proxyURL}`]
                    });
                
                    page = await browser.newPage();
                    await page.authenticate({ username, password });
                
                    await page.setRequestInterception(true);
        
                    page.on('request', (request) => {
                    const resourceType = request.resourceType();
                    if (resourceType == 'document'){
                        request.continue();
                    } else {
                        request.continue()
                        //request.abort()
                    } })
                };
        
                ///-----------------------------------------///
        
                let HabLink = listLink.split('venta-viviendas');
                //for(let i = 0; i <= 60; i++){
                let newhabLink = `${HabLink[0]}alquiler-habitacion${HabLink[1]}&ordenado-por=precios-asc`;
                console.log('NewHablink',newhabLink);
                //}
                const maxRetriess = 3;
                let Retriess = 0;
                let checkk;
                
                while (Retriess < maxRetriess) {
                try {
                    await delay(500)   // Wait a bit due to race 
                    checkk = await page.goto(newhabLink, { waitUntil: 'domcontentloaded', timeout: 0 });
                    console.log('Navigation successful');
                    break; // Exit the loop if navigation is successful
                } catch (error) {
                    if (error.message.includes('Navigating frame was detached')) {
                    console.error(`Retry ${Retriess + 1}: Frame Detached Error - ${error.message}`);
                    Retriess++;
                    } else if (error.message.includes('net::ERR_TIMED_OUT')) {
                    console.error(`Retry ${Retriess + 1}: Timeout Error - ${error.message}`);
                    Retriess++;
                    } else if (error.message.includes('net::ERR_CONNECTION_CLOSED')) {
                        console.error(`Retry ${Retriess + 1}: Timeout Error - ${error.message}`);
                        Retriess++;
                    } else if (error.message.includes('net::ERR_CONNECTION_RESET')) {
                        console.error(`Retry ${Retriess + 1}: Timeout Error - ${error.message}`);
                        Retriess++;
                    } else if (error.message.includes('net::ERR_PROXY_CONNECTION_FAILED')) {
                        console.error(`Retry ${Retriess + 1}: Timeout Error - ${error.message}`);
                        Retriess++;
                    } else if (error.message.includes('net::ERR_CERT_AUTHORITY_INVALID')) {
                        console.error(`Retry ${Retriess + 1}: Timeout Error - ${error.message}`);
                        Retriess++;
                    } else {
                    console.error(`Unexpected error: ${error.message}`);
                    throw error; // Throw other unexpected errors
                    }
                }
                }
                
                if (Retriess === maxRetriess) {
                console.error('Failed to navigate after maximum retry attempts');
                // Optionally handle the error gracefully to keep the code running
                }

                let Intentoss = 0;
                const maxIntentoss = 3; // Define un número máximo de Intentoss para evitar bucles infinitos
                
                while (Intentoss < maxIntentoss) {
                    try {
                        statuss = await checkk.status();
                        break; // Si la ejecución tiene éxito, salimos del bucle
                    } catch (error) {
                        if (error instanceof TypeError && error.message.includes("Cannot read properties of null (reading 'statuss')")) {
                            console.log(`Error al obtener el estado. Intentando de nuevo (${Intentoss + 1}/${maxIntentoss})...`);
                            Intentoss++;
                            // Puedes agregar un pequeño retraso aquí si es necesario
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                        } else {
                            // Si es otro tipo de error, lánzalo para que se maneje en otro lugar
                            throw error;
                        }
                    }
                }
                
                if (statuss === undefined) {
                    console.error("No se pudo obtener el estado después de varios intentos.");
                    // Maneja el caso en el que no se pudo obtener el estado después de varios intentos
                } else {
                  // Aquí puedes continuar con el resto de tu código que depende de 'status'
                  console.log("Estado obtenido:", statuss);
                }

                if (statuss == 200) {
                    let Nextpage = {}
                    do{    
                        const hablinks = await page.evaluate(() => {
                        let links = document.querySelectorAll('a.item-link');
                        let links2 = Array.from(links).map(link => link.href);
                        return links2;
                    });
        
                    Nextpage = await page.evaluate(()=>{
                        let next = document.querySelector('a.icon-arrow-right-after');
                        if( next ){
                            return {
                                exists : true,
                                link : next.href
                            };
                        }else{
                            return {
                                exists : false,
                                link : "N/A"
                            };
                        }
                    });
        
                    if (Nextpage.exists == true) {
                        await page.goto(Nextpage.link, { waitUntil: 'domcontentloaded',timeout:0 });
                        console.log('going to new page')
                        console.log(Nextpage)
                    }else{
                        console.log(Nextpage)
                        console.log('no more pages')
                    }
        
                    habArray.push(...hablinks);
                    console.log('----------')
                    console.log('----------')
                    console.log(habArray);
                    console.log(habArray.length);
                    console.log(Nextpage)
                    console.log('----------')
                    console.log('----------')
                    
                }while(Nextpage.exists == true)
        


                }else {
                    console.log(`Página no accesible: ${Link} (Status: ${statuss})`);
                    await page.close();
                    await browser.close();
                }
            }while(statuss != 200)

                let count = 0;
                
                for(const url of habArray){
                    count ++;


                    do{
        
                        if(page.isClosed()){
                            statuss = 200
                            console.log('page is closed due status 403, reopeing page');
                            browser = await puppeteer.launch({
                            headless: true,
                           //slowMo: 1000,
                            args: [`--proxy-server=${proxyURL}`]
                            });
                        
                            page = await browser.newPage();
                            await page.authenticate({ username, password });
                        
                            await page.setRequestInterception(true);
        
                            page.on('request', (request) => {
                            const resourceType = request.resourceType();
                
                        if (resourceType == 'document'){
                            request.continue();
                        } else {
                            request.abort()
                        }
                    });                    
                        }
        
        
                        dataHab = {
                            precio : 'N/A',
                            actualizado : 'N/A',
                            Coords : 'N/A',
                            link : url
                        }
        
                        if(count <= 10){
                            console.log(count)
                        check = await page.goto(url,{waitUntil:'domcontentloaded', timeout:0});
                        statuss = check.status();
                        
                        if(statuss == 200){
        
                            
                            dataHab = await page.evaluate(()=>{
                                
                                const rawprecio = document.querySelector('span.info-data-price');
                                const casiprecio =  rawprecio ? rawprecio.innerText.split(" ")[0] : 'N/A';
                                const casicasiprecio = casiprecio.replace(/\./g,"")
                                const precio = parseInt(casicasiprecio);
                                
                                const rawDatee = document.querySelector('p.date-update-text');
                                const rawDate = rawDatee ? rawDatee.innerText : 'N/A';
                                let date
                                if(rawDate.includes('hace')){
                                    let casidate = rawDate.split('hace ');
                                    date = casidate[1];
                                    if(casidate[1].includes('más de')){
                                        let doneupdate = casidate[1].replace('más de ','');
                                        date = doneupdate;
                                    }
                                }else{
                                    date = rawDate;
                                }
        
                                return {
                                    precio : precio,
                                    actualizado : date
                                }
                            })                    
                        
                        
            
                        }else{
                            console.log(`Página no accesible: ${url} (Status: ${statuss})`);
                                await page.close();
                                await browser.close();
                            }
                        }
                        
                        if(statuss == 200){
                            
                    let HabId = url.split('/');
                    let numero = HabId[HabId.length - 2];
                    
                    const maxRetries = 3;
                    let retries = 0;
                    let check;
                    
                    while (retries < maxRetries) {
                      try {
                        check = await page.goto(`https://www.idealista.com/ajax/detailController/staticMapUrl.ajax?adId=${numero}&width=646&height=330#`, 
                        { waitUntil: 'domcontentloaded', timeout: 0 });
                        console.log('Navigation successful');
                        break; // Salir del bucle si la navegación tiene éxito
                      } catch (error) {
                        if (error.message.includes('Navigating frame was detached')) {
                          console.error(`Retry ${retries + 1}: Frame Detached Error - ${error.message}`);
                          retries++;
                        } else if (error.message.includes('net::ERR_TIMED_OUT')) {
                          console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                          retries++;
                        } else if (error.message.includes('net::ERR_CONNECTION_CLOSED')) {
                            console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                            retries++;
                        } else if (error.message.includes('net::ERR_CONNECTION_RESET')) {
                            console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                            retries++;
                        } else if (error.message.includes('net::ERR_PROXY_CONNECTION_FAILED')) {
                            console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                            retries++;
                        } else if (error.message.includes('net::ERR_CERT_AUTHORITY_INVALID')) {
                            console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                            retries++;
                        } else {
                          console.error(`Unexpected error: ${error.message}`);
                          throw error; // Lanza otros errores inesperados
                        }
                      }
                    }
                    
                    if (retries === maxRetries) {
                      console.error('Failed to navigate after maximum retry attempts');
                      // Maneja el error de forma opcional para que el código siga ejecutándose
                    }
                    
                    // Continúa con el resto de tu código
                    let intentos = 0;
const maxIntentos = 3; // Define un número máximo de intentos para evitar bucles infinitos

while (intentos < maxIntentos) {
    try {
        statuss = await check.status();
        break; // Si la ejecución tiene éxito, salimos del bucle
    } catch (error) {
        if (error instanceof TypeError && error.message.includes("Cannot read properties of null (reading 'status')")) {
            console.log(`Error al obtener el estado. Intentando de nuevo (${intentos + 1}/${maxIntentos})...`);
            intentos++;
            // Puedes agregar un pequeño retraso aquí si es necesario
            await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
        } else {
            // Si es otro tipo de error, lánzalo para que se maneje en otro lugar
            throw error;
        }
    }
}

if (statuss === undefined) {
    console.error("No se pudo obtener el estado después de varios intentos.");
    // Maneja el caso en el que no se pudo obtener el estado después de varios intentos
} else {
  // Aquí puedes continuar con el resto de tu código que depende de 'status'
  console.log("Estado obtenido:", statuss);
}
                    if (statuss == 200) {
        
                    coords = await page.evaluate(()=>{
                        let rawCords= document.querySelector('pre') ? document.querySelector('pre').innerText : 'N/A';  
        
                        if (rawCords == 'N/A') {
                            return 'N/A';
                        }
                        let textParts = rawCords.toString();
                        let parts = textParts .split('center=');
                        let partcoords = parts[1].split('&');
                        let soloCoords = partcoords[0].split('%2C');
                        let pureCords = soloCoords[0] + ',' + soloCoords[1];        
                        return pureCords  ? pureCords  : 'N/A';
                    });
                        dataHab.link = url;
                        dataHab.CoordsHab = coords;
                        //console.log('info habitacion',dataHab)
                        HabAll.push(dataHab)
                        console.log('habAll:', HabAll)
                        
                        const [lat1, lon1] = MotherCoords.split(',').map(Number);
                        const [lat2, lon2] = coords.split(',').map(Number);
                        // Compute the distance
                        const distanceInMeters = haversineDistance(lat1, lon1, lat2, lon2);
                        if (distanceInMeters < radio) {
                            enradio ++;
                    }
                    console.log('radio: ',radio,' distancia :',distanceInMeters,'res:',distanceInMeters < radio)
        
                }else {
                    console.log(url)
                    console.log(`ajax no accesible: https://www.idealista.com/ajax/detailController/staticMapUrl.ajax?adId=${numero}&width=646&height=330#  (Status: ${statuss})`);
                        await page.close();
                        await browser.close();
                }
        

                        }
                    }while(statuss != 200)
                    }
                    console.log('saliendo del ciclo de habitaciones')
                    
                    HabAll.forEach(hab=>{
                        if(hab.actualizado != 'N/A'){
                            solodate.push(hab.actualizado);
                        }
                    })
        
                    console.log('solodate:',solodate);
                    Promediotiempo = calcularPromedioTiempo(solodate);
			solodate.length = 0;
// Establecer cada "hab.actualizado" en 'N/A'
HabAll.forEach(hab => {
    hab.actualizado = 'N/A';
});
                    
                await browser.close();
            }catch(error){
                return console.error(error); 
            }
        
            let utilHabs = 0;
            let suma = 0 ;
            HabAll.forEach(hab=>{
        
                if (hab.precio != 'N/A') {
                    utilHabs ++;
                    suma = suma + hab.precio;
                }
            })
            CosteMedio = suma / utilHabs;
            try {
                let url = listLink;
                const Hrefs = [];
        
                try {
                    let statuss
                    let count = 0;
                    
                    let browser1 = await puppeteer.launch({
                        headless: true,
                    args: [`--proxy-server=${proxyURL}`]
                    });
        
                let page1 = await browser1.newPage();
                await page1.authenticate({ username, password });
        
                await page1.setRequestInterception(true);
                // Variable para controlar si se debe abortar todas las solicitudes
        
                page1.on('request', (request) => {
                    const resourceType = request.resourceType();
                
                    if (resourceType == 'document'){
                        request.continue();
                    } else {
                        request.abort();
                    }
                });
                let Nextpage = {}
                        do{
        ////////////////////////////
                            if(page1.isClosed()){
                                console.log('page is closed due status 403, reopeing page');
                                browser1 = await puppeteer.launch({
                                headless: true,
                               //slowMo: 1000,
                                args: [`--proxy-server=${proxyURL}`]
                                });
                            
                                page1 = await browser1.newPage();
                                await page1.authenticate({ username, password });
                            
                                await page1.setRequestInterception(true);
        
                                page1.on('request', (request) => {
                                const resourceType = request.resourceType();
                    
                            if (resourceType == 'document'){
                                request.continue();
                            } else {
                                request.abort()
                            }
                        });                    
        }
        ///////////////////////////
                        let check = await page1.goto(url, { waitUntil: 'domcontentloaded',timeout: 0 });
        
                        statuss = await check.status();
                        if (statuss == 200) {
        
                            const newHrefs = await page1.evaluate(() => {
                                return Array.from(document.querySelectorAll('a.item-link')).map(link => link.href);
                            });
                            
                            Hrefs.push(...newHrefs);
                            console.log(Hrefs);
                            console.log(timeer);
        
                            Nextpage = await page1.evaluate(()=>{
                                let next = document.querySelector('a.icon-arrow-right-after');
                                if( next ){
                                    return {
                                        exists : true,
                                        link : next.href
                                    };
                                }else{
                                    return {
                                        exists : false,
                                        link : "N/A"
                                    };
                                }
                            });
                
                            if (Nextpage.exists == true) {
                                url = Nextpage.link;
                                    console.log('going to new page')
                                    console.log(Nextpage)
                            }else{
                                console.log(Nextpage)
                                console.log('no more pages')
                            }
                
        
                        } else {
                            console.log(`Página no accesible: ${url} (Status: ${statuss})`);
                                await page1.close();
                                await browser1.close();
                        }
                        
                    }while(statuss !=200 || Nextpage.exists == true)
                    
        
                    await page1.close();
                    await browser1.close();
        
                                        
                let browser = await puppeteer.launch({
                    headless: true,
                  //slowMo: 1000,
                    args: [`--proxy-server=${proxyURL}`]
                });
                                    let page = await browser.newPage();
                                    //let page2 = await browser.newPage();
                                    await page.authenticate({ username, password });
                                    //await page2.authenticate({ username, password });
        
                                    await page.setRequestInterception(true);
                
                                    page.on('request', (request) => {
                                    const resourceType = request.resourceType();
                                    
                                    if (resourceType == 'document'){
                                        request.continue();
                                    } else {
                                        request.abort();
                                    }
                                    });
        
                    for (const href of Hrefs) {

                        if(allRoundInfo.length == 0){
                            count++;
                        let rStatus 
                        do {

                            if(page.isClosed()){
                                console.log('page is closed due status 403, reopeing page');
                                browser = await puppeteer.launch({
                                headless: true,
                                args: [`--proxy-server=${proxyURL}`]
                                });
        
                                page = await browser.newPage();
                                await page.authenticate({ username, password });
                            
                                await page.setRequestInterception(true);
                            
                                    page.on('request', (request) => {
                                        const resourceType = request.resourceType();
                                        let url = request.url();
                                        if (resourceType == 'document'){
                                            request.continue();
                                        } else {
                                            request.abort();
                                        }
                                    });                    
                            }                        
                            
                            const maxRetries = 3;
                            let retries = 0;
                            let rrStatus;

                            while (retries < maxRetries) {
                            try {
                                await delay(50)   // Wait a bit due to race 
                                rrStatus = await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 0 });
                                console.log('Navigation successful');
                                break; // Exit the loop if navigation is successful
                            } catch (error) {
                                if (error.message.includes('net::ERR_CONNECTION_RESET')) {
                                console.error(`Retry ${retries + 1}: Error - ${error.message}`);
                                retries++;
                            } else if (error.message.includes('net::ERR_TIMED_OUT')) {
                                console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                                retries++;
                            } else if (error.message.includes('net::ERR_CONNECTION_CLOSED')) {
                                console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                                retries++;
                            } else if (error.message.includes('Navigating frame was detached')) {
                                    console.error(`Retry ${retries + 1}: Frame Detached Error - ${error.message}`);
                                    retries++;
                                } else if (error.message.includes('net::ERR_PROXY_CONNECTION_FAILED')) {
                                    console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                                    retries++;
                                } else if (error.message.includes('net::ERR_CERT_AUTHORITY_INVALID')) {
                                    console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                                    retries++;
                                } else {
                                console.error(`Unexpected error: ${error.message}`);
                                throw error; // Re-throw unexpected errors
                                }
                            }
                            }

                            if (retries === maxRetries) {
                            console.error('Failed to navigate after maximum retry attempts');
                            // Optionally handle the error gracefully to continue the execution
                            }

                            // Proceed with the rest of your code

        
                            rStatus = await rrStatus.status()
        
                            console.log('-------')
                            console.log('-------')
                            console.log('-------')
                            console.log(rStatus)
                            console.log('-------')
                            console.log('-------')
                            console.log('-------')
                            
                            if(rStatus == 200 ){
                            const data2 = await page.evaluate(() => {
                                const rawprecio = document.querySelector('span.info-data-price');
                                const casiprecio =  rawprecio ? rawprecio.innerText.split(" ")[0] : 'N/A';
                                const casicasiprecio = casiprecio.replace(/\./g,"")
                                const precio = parseInt(casicasiprecio);

                                return {
                                    'Precio' : precio 
                                }
                            })
                            const data = await page.evaluate(() => {
        

                                let ubicacion = document.querySelector('#headerMap ul');
                                let rawdireccion = ubicacion ? ubicacion.innerText : "N/A";
                                let direccion = rawdireccion.replace(/\n/g, ', ');
        
                                let caracteristicas = {
                                    metros2:"N/A",
                                    nHabitaciones:"1", 
                                    nBath:"N/A",
                                    planta:"N/A",
                                    ascensor:"No",
                                    calefaccion:"No",
                                    tipoCalefaccion:"N/A",
                                    aire:"N/A",
                                    piscina:"No",
                                    construido: "N/A",
                                    metros2Utiles: "N/A",
                                    Coords : "N/A",
                                    ascensor : "No"
                                }
        
                                const carac = document.querySelectorAll('div.details-property-feature-one div.details-property_features ul li')
                                carac.forEach(dt=>{
                                    let content = dt.innerText;
        
                                    if (content.includes('m²') && caracteristicas.metros2 == "N/A") {
                                        if(content.includes(',')){
                                            let arrM2 = content.split(',')
                                            if(arrM2[0].includes('construidos')){
                                                let cutt = arrM2[0].split(' ');
                                                caracteristicas.metros2 = cutt[0];    
                                            }
                                            if(arrM2[1].includes('útiles')){
                                                let cuttt = arrM2[1].split(' ');
                                                caracteristicas.metros2Utiles = cuttt[1];
                                            }else{
                                                caracteristicas.metros2Utiles = 'N/A';
                                            }
                                        }else{
                                            let m2cleaned = content.split(' ')[0];
                                            caracteristicas.metros2 = m2cleaned;
                                        }
                                    } else if (content.includes('habitaciones')) {
                                        let cutData = content.split(' '); 
                                        caracteristicas.nHabitaciones = cutData[0];
                                    } else if (content.includes('baño')) {
                                        let n =  content.split(" ")
                                        caracteristicas.nBath = n[0];
                                    } else if (content.includes('Calefacción')) {
                                        caracteristicas.calefaccion = 'si';
                                        if(content.includes(':')){

                                            let rawtipo = content.split(':');
                                            let tipo = rawtipo[1]; 
                                            caracteristicas.tipoCalefaccion = tipo;
                                        }else{
                                            caracteristicas.tipoCalefaccion = content;
                                        }
                                    } else if (content.includes('Planta')) {
                                        let cut = content.split(' ');
                                        caracteristicas.planta = cut ? cut[1] : 'error en if planta';
                                    }else if(content.includes('exterior')){
                                        if(content.includes('Bajo')){
                                        caracteristicas.planta = content ? "Bajo Exterior" : "Bajo Exterior";
                                        }else{
                                            caracteristicas.planta = content ? "Exterior" : "Exterior";
                                        } 
                                    }else if(content.includes('Sótano')){
                                        caracteristicas.planta = "Sótano";
                                    }else if (content.includes('Entreplanta')) {
                                        caracteristicas.planta = "Entreplanta";
                                    }else if (content.includes('Con ascensor')) {
                                        caracteristicas.ascensor = 'si';
                                    }else if (content.includes('Construido')) {
                                        caracteristicas.construido = content;
                                    }
                                })
        
                                const carac2 = document.querySelectorAll('div.details-property-feature-two div.details-property_features ul li')
                                carac2.forEach(dt=>{
                                    let content = dt.innerText 
                                    if (content.includes('Piscina')) {
                                        caracteristicas.piscina = content;
                                    } else if (content.includes('Aire')) {
                                        caracteristicas.aire = content;
                                    }
                                })
        
                                return {
                                    'Dirección': direccion,
                                    'm²': caracteristicas.metros2,
                                    'm² Útiles': caracteristicas.metros2Utiles,
                                    'construido' : caracteristicas.construido,
                                    "Habitaciones" : caracteristicas.nHabitaciones,
                                    "nBaños" : caracteristicas.nBath,
                                    'planta' : caracteristicas.planta,
                                    'ascensor' : caracteristicas.ascensor,
                                    'calefaccion': caracteristicas.calefaccion,
                                    'tipo de Calefaccion' : caracteristicas.tipoCalefaccion,
                                    'aire' : caracteristicas.aire,
                                    'pisicina' : caracteristicas.piscina
                                    // 'Precio': precio // Actualmente se encuentra aqui!! {N1}
                                };

                            });
        
        
                                const parts = href.split("/");
                                const numero = parts[parts.length - 2];
        
                            let responsee = await page.goto(`https://www.idealista.com/ajax/detailController/staticMapUrl.ajax?adId=${numero}&width=646&height=330#`,{waitUntil: 'domcontentloaded',timeout:0});
                            rStatus = responsee.status();
                            let cords = await page.evaluate(()=>{
                                let rawCords= document.querySelector('pre') ? document.querySelector('pre').innerText : 'N/A';  
        
                                if (rawCords == 'N/A') {
                                    return 'N/A';
                                }
                                let textParts = rawCords.toString();
                                let parts = textParts .split('center=');
                                let partcoords = parts[1].split('&');
                                let soloCoords = partcoords[0].split('%2C');
                                let pureCords = soloCoords[0] + ',' + soloCoords[1];        
                                return pureCords  ? pureCords  : 'N/A';
                            });
                            coords = cords
        
                            //Aqui esta la distancia en metros, constante distanceInMeters, pasar a la casilla "distancia a la entidad"!
                            //Si la distancia es mayor a la introducida por consola, no llenar esa columna del excel.
                            
                            //Aqui calculo necesario
                        
                            let NumeroDeHabitaciones = data.Habitaciones;
                            let MesesDelAnio = 12;
        
                            let a = CosteMedio * NumeroDeHabitaciones * MesesDelAnio;
                            let b = data2.Precio;
        
                            let c = a/b;
        
                            let d = c * 100;
        
                            let resultadoFormateado = d.toFixed(2);
        
                            let Rentabilidad = `${resultadoFormateado}%`
                            ///Esta variable Rentabilidad pasarlo a la casilla de Rentabilidad, esto es lo que si va a cambiar en
                            // cada iteracion asi se repitan los mismos datos de las habitaciones
        
                            
                            // Parse the coordinate strings
                            const [lat1, lon1] = MotherCoords.split(',').map(Number);
                            const [lat2, lon2] = coords.split(',').map(Number);
                            // Compute the distance
                            const distanceInMeters = haversineDistance(lat1, lon1, lat2, lon2);
                            if (parseFloat(distanceInMeters) < parseFloat(radio)) {
                            data.Entidad = linkMaps.entidad; 
                            data.Ciudad = linkMaps.ciudad;
                            data.UbicacionEntidad = linkMaps.link;
                            data.nEstudaintesAprox = linkMaps.nestudent;
                            data.TipoEntidad = linkMaps.TipoEnt;
                            data.Agrupacion = linkMaps.agr;
                            data.DistancaAEntidad = distanceInMeters;
                            data.HabitacionesEnRango = enradio ;
                            data.PrecioMedio = CosteMedio;
                            data.MedianaTiempo = Promediotiempo;
                            data.Precio = data2.Precio;
                            data.Rentabilidad = Rentabilidad;
                            data.Anuncio = href;
                            allRoundInfo.push(data);
                            console.log(data);
                            console.log(`Distance: ${distanceInMeters} meters`);
                            }else{
                            console.log('casa fuera de rango, distancia en metros:',distanceInMeters, 'radio optimo: ',radio)
                        
                            data.Coords = cords;
                            data.Anuncio = href;
                            data.inmuebleNro = count;
                            data.timer = timeer;
                            console.log(data);
                            }
        
                            }else if (rStatus == 404 ){
                                console.log(`La vivienda ${href} acaba de ser eliminada de la pagina, pasando a la siguiente`);
                                break;
                            }
                                                        
                            else{
                                //await page2.close();
                                await page.close();
                                await browser.close();
                            }
                                        
                        } while (rStatus != 200 || coords == 'N/A');
                        }

                        else if(allRoundInfo[allRoundInfo.length - 1].link != href){
                        count++;
                        let rStatus 
                        do {

                            if(page.isClosed()){
                                console.log('page is closed due status 403, reopeing page');
                                browser = await puppeteer.launch({
                                headless: true,
                                args: [`--proxy-server=${proxyURL}`]
                                });
        
                                page = await browser.newPage();
                                await page.authenticate({ username, password });
                            
                                await page.setRequestInterception(true);
                            
                                    page.on('request', (request) => {
                                        const resourceType = request.resourceType();
                                        let url = request.url();
                                        if (resourceType == 'document'){
                                            request.continue();
                                        } else {
                                            request.abort();
                                        }
                                    });                    
                            }                        
                            
                            const maxRetries = 3;
                            let retries = 0;
                            let rrStatus;

                            while (retries < maxRetries) {
                            try {
                                await delay(50)   // Wait a bit due to race 
                                rrStatus = await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 0 });
                                console.log('Navigation successful');
                                break; // Exit the loop if navigation is successful
                            } catch (error) {
                                if (error.message.includes('net::ERR_CONNECTION_RESET')) {
                                console.error(`Retry ${retries + 1}: Error - ${error.message}`);
                                retries++;
                            } else if (error.message.includes('net::ERR_TIMED_OUT')) {
                                console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                                retries++;
                            } else if (error.message.includes('net::ERR_CONNECTION_CLOSED')) {
                                console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                                retries++;
                            } else if (error.message.includes('Navigating frame was detached')) {
                                    console.error(`Retry ${retries + 1}: Frame Detached Error - ${error.message}`);
                                    retries++;
                                } else if (error.message.includes('net::ERR_PROXY_CONNECTION_FAILED')) {
                                    console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                                    retries++;
                                } else if (error.message.includes('net::ERR_CERT_AUTHORITY_INVALID')) {
                                    console.error(`Retry ${retries + 1}: Timeout Error - ${error.message}`);
                                    retries++;
                                } else {
                                console.error(`Unexpected error: ${error.message}`);
                                throw error; // Re-throw unexpected errors
                                }
                            }
                            }

                            if (retries === maxRetries) {
                            console.error('Failed to navigate after maximum retry attempts');
                            // Optionally handle the error gracefully to continue the execution
                            }

                            // Proceed with the rest of your code

        
                            rStatus = await rrStatus.status()
        
                            console.log('-------')
                            console.log('-------')
                            console.log('-------')
                            console.log(rStatus)
                            console.log('-------')
                            console.log('-------')
                            console.log('-------')
                            
                            if(rStatus == 200 ){
                            const data2 = await page.evaluate(() => {
                                const rawprecio = document.querySelector('span.info-data-price');
                                const casiprecio =  rawprecio ? rawprecio.innerText.split(" ")[0] : 'N/A';
                                const casicasiprecio = casiprecio.replace(/\./g,"")
                                const precio = parseInt(casicasiprecio);

                                return {
                                    'Precio' : precio 
                                }
                            })
                            const data = await page.evaluate(() => {
        

                                let ubicacion = document.querySelector('#headerMap ul');
                                let rawdireccion = ubicacion ? ubicacion.innerText : "N/A";
                                let direccion = rawdireccion.replace(/\n/g, ', ');
        
                                let caracteristicas = {
                                    metros2:"N/A",
                                    nHabitaciones:"1", 
                                    nBath:"1",
                                    planta:"N/A",
                                    ascensor:"No",
                                    calefaccion:"No",
                                    tipoCalefaccion:"N/A",
                                    aire:"N/A",
                                    piscina:"No",
                                    construido: "N/A",
                                    metros2Utiles: "N/A",
                                    Coords : "N/A",
                                    ascensor : "No"
                                }
        
                                const carac = document.querySelectorAll('div.details-property-feature-one div.details-property_features ul li')
                                carac.forEach(dt=>{
                                    let content = dt.innerText;
        
                                    if (content.includes('m²') && caracteristicas.metros2 == "N/A") {
                                        if(content.includes(',')){
                                            let arrM2 = content.split(',')
                                            if(arrM2[0].includes('construidos')){
                                                let cutt = arrM2[0].split(' ');
                                                caracteristicas.metros2 = cutt[0];    
                                            }
                                            if(arrM2[1].includes('útiles')){
                                                let cuttt = arrM2[1].split(' ');
                                                caracteristicas.metros2Utiles = cuttt[1];
                                            }else{
                                                caracteristicas.metros2Utiles = 'N/A';
                                            }
                                        }else{
                                            let m2cleaned = content.split(' ')[0];
                                            caracteristicas.metros2 = m2cleaned;
                                        }
                                    } else if (content.includes('habitaciones')) {
                                        let cutData = content.split(' '); 
                                        caracteristicas.nHabitaciones = cutData[0];
                                    } else if (content.includes('baño')) {
                                        let n =  content.split(" ")
                                        caracteristicas.nBath = n[0];
                                    } else if (content.includes('Calefacción')) {
                                        caracteristicas.calefaccion = 'si';
                                        if(content.includes(':')){

                                            let rawtipo = content.split(':');
                                            let tipo = rawtipo[1]; 
                                            caracteristicas.tipoCalefaccion = tipo;
                                        }else{
                                            caracteristicas.tipoCalefaccion = content;
                                        }
                                    } else if (content.includes('Planta')) {
                                        let cut = content.split(' ');
                                        caracteristicas.planta = cut ? cut[1] : 'error en if planta';
                                    }else if(content.includes('exterior')){
                                        if(content.includes('Bajo')){
                                        caracteristicas.planta = content ? "Bajo Exterior" : "Bajo Exterior";
                                        }else{
                                            caracteristicas.planta = content ? "Exterior" : "Exterior";;
                                        } 

                                    }else if (content.includes('Con ascensor')) {
                                        caracteristicas.ascensor = 'si';
                                    }else if (content.includes('Construido')) {
                                        caracteristicas.construido = content;
                                    }
                                })
        
                                const carac2 = document.querySelectorAll('div.details-property-feature-two div.details-property_features ul li')
                                carac2.forEach(dt=>{
                                    let content = dt.innerText 
                                    if (content.includes('Piscina')) {
                                        caracteristicas.piscina = content;
                                    } else if (content.includes('Aire')) {
                                        caracteristicas.aire = content;
                                    }
                                })
        
                                return {
                                    'Dirección': direccion,
                                    'm²': caracteristicas.metros2,
                                    'm² Útiles': caracteristicas.metros2Utiles,
                                    'construido' : caracteristicas.construido,
                                    "Habitaciones" : caracteristicas.nHabitaciones,
                                    "nBaños" : caracteristicas.nBath,
                                    'planta' : caracteristicas.planta,
                                    'ascensor' : caracteristicas.ascensor,
                                    'calefaccion': caracteristicas.calefaccion,
                                    'tipo de Calefaccion' : caracteristicas.tipoCalefaccion,
                                    'aire' : caracteristicas.aire,
                                    'pisicina' : caracteristicas.piscina
                                    // 'Precio': precio // Actualmente se encuentra aqui!! {N1}
                                };

                            });
        
        
                                const parts = href.split("/");
                                const numero = parts[parts.length - 2];
        
                            let responsee = await page.goto(`https://www.idealista.com/ajax/detailController/staticMapUrl.ajax?adId=${numero}&width=646&height=330#`,{waitUntil: 'domcontentloaded',timeout:0});
                            rStatus = responsee.status();
                            let cords = await page.evaluate(()=>{
                                let rawCords= document.querySelector('pre') ? document.querySelector('pre').innerText : 'N/A';  
        
                                if (rawCords == 'N/A') {
                                    return 'N/A';
                                }
                                let textParts = rawCords.toString();
                                let parts = textParts .split('center=');
                                let partcoords = parts[1].split('&');
                                let soloCoords = partcoords[0].split('%2C');
                                let pureCords = soloCoords[0] + ',' + soloCoords[1];        
                                return pureCords  ? pureCords  : 'N/A';
                            });
                            coords = cords
        
                            //Aqui esta la distancia en metros, constante distanceInMeters, pasar a la casilla "distancia a la entidad"!
                            //Si la distancia es mayor a la introducida por consola, no llenar esa columna del excel.
                            
                            //Aqui calculo necesario
                        
                            let NumeroDeHabitaciones = data.Habitaciones;
                            let MesesDelAnio = 12;
        
                            let a = CosteMedio * NumeroDeHabitaciones * MesesDelAnio;
                            let b = data2.Precio;
        
                            let c = a/b;
        
                            let d = c * 100;
        
                            let resultadoFormateado = d.toFixed(2);
        
                            let Rentabilidad = `${resultadoFormateado}%`
                            ///Esta variable Rentabilidad pasarlo a la casilla de Rentabilidad, esto es lo que si va a cambiar en
                            // cada iteracion asi se repitan los mismos datos de las habitaciones
        
                            
                            // Parse the coordinate strings
                            const [lat1, lon1] = MotherCoords.split(',').map(Number);
                            const [lat2, lon2] = coords.split(',').map(Number);
                            // Compute the distance
                            const distanceInMeters = haversineDistance(lat1, lon1, lat2, lon2);
                            if (parseFloat(distanceInMeters) < parseFloat(radio)) {
                            data.Entidad = linkMaps.entidad; 
                            data.Ciudad = linkMaps.ciudad;
                            data.UbicacionEntidad = linkMaps.link;
                            data.nEstudaintesAprox = linkMaps.nestudent;
                            data.TipoEntidad = linkMaps.TipoEnt;
                            data.Agrupacion = linkMaps.agr;
                            data.DistancaAEntidad = distanceInMeters;
                            data.HabitacionesEnRango = enradio ;
                            data.PrecioMedio = CosteMedio;
                            data.MedianaTiempo = Promediotiempo;
                            data.Precio = data2.Precio;
                            data.Rentabilidad = Rentabilidad;
                            data.Anuncio = href;
                            allRoundInfo.push(data);
                            console.log(data);
                            console.log(`Distance: ${distanceInMeters} meters`);
                            }else{
                            console.log('casa fuera de rango, distancia en metros:',distanceInMeters, 'radio optimo: ',radio)
                        
                            data.Coords = cords;
                            data.Anuncio = href;
                            data.inmuebleNro = count;
                            data.timer = timeer;
                            console.log(data);
                            }
        
                            }else if (rStatus == 404 ){
                                console.log(`La vivienda ${href} acaba de ser eliminada de la pagina, pasando a la siguiente`);
                                break;
                            }
                                                        
                            else{
                                //await page2.close();
                                await page.close();
                                await browser.close();
                            }
                                        
                        } while (rStatus != 200 || coords == 'N/A');
                    }
                    }
                    if(allRoundInfo.length > 0 ){

                        allInfo.push(...allRoundInfo)
                    }else{
                        console.log(`no hay casas disponibles para la entidad ${linkMaps.entidad}, en el radio ${radio}`)
                    }

/*
celda
entidad
ciudad
nestudent
TipoEnt
agr
*/
                await browser.close();
        //----------------------------------------------------------//
        
	fs.readdirSync('./').forEach(file => {
  		if (path.extname(file) === '.xlsx') {
		    fs.unlinkSync(file);
    		    console.log(`Archivo Excel eliminado: ${file}`);
  		}
	});

        const worksheet = XLSX.utils.json_to_sheet(allInfo);
        // Crear una nueva hoja de cálculo a partir del array JSON
        
        // Crear un nuevo libro de trabajo
        const workbook = XLSX.utils.book_new();
        
        // Agregar la hoja de cálculo al libro de trabajo
        XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
        
        // Obtener la fecha y hora actual
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // Sumar 1 porque los meses van de 0 a 11
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        // Formatear la fecha y hora para el nombre del archivo
        const dateTimeString = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
        
        // Crear el nombre del archivo con la fecha y hora
        const filename = `datos_${dateTimeString}.xlsx`;
        
        // Escribir el libro de trabajo en el archivo Excel con el nombre generado
        XLSX.writeFile(workbook, filename);
        
        console.log(`Archivo Excel creado con éxito: ${filename}`);
        
        //----------------------------------------------------------//
         // Enviar la respuesta una vez que se completa el scraping
                } catch (error) {
                    
                    return console.error(error); 
                }
        
            } catch (error) {
                console.error(error);
            }


};

        
    }catch(error){
        return console.error(error);
    }

    // scrpeando habitaciones

})();
