# MetaData

La classe MetaData  � usata per centralizzare le informazioni relative alle tabelle del database, in particolare
 ogni classe derivata, che deve chiamarsi meta_[tablename] contiene le informazioni sulla tabella tablename.

� importante il nome della classe e del file per come questo viene poi caricato da disco quando richiesto, in modo lazy.

Le istanze delle classi derivanti da MetaData in questo documento sono chiamate metadati.

I metodi della classe MetaData sono perlopi� dei segnaposto dove inserire determinate informazioni su una tabella o 
 vista, che poi saranno eventualmente utilizzati dal framework e dal resto del proprio applicativo alla bisogna.

Sono pertanto un meccanismo per far si che esista un posto unico e noto a tutti gli sviluppatori e manutentori per
 descrivere i vari aspetti di ogni tabella, in modo che sia unico e accessibile ovunque.


## Uso trasversale 
La classe MetaData � gestita in modo tale da poter essere usata sia sul client che sul server.
Nel codice un metadato comune a client e server � quindi impossibile accedere a propriet� della classe AppMeta del 
 client.


### Retrieving di un metadato
Il metodo di istanziazione di un oggetto di tipo MetaData cambia a seconda di dove ci si trovi:

- nel codice di un metadato il metodo corretto per istanziare un metadato � invocare this.getMeta. Questo in modo 
  identico sia lato client che lato server, cosi da poter usare e manutenere un unico file per metadato.
- al di fuori del codice di un metadato:
    - nel client: invocare il metodo getMeta dell'oggetto appMeta,
      che � l'applicativo del frontend myKode_Frontend
    - lato server il metodo corretto per instanziare un metadato � invocare la funzione getMeta del Context

### Accesso ai dati
I metodi che intendono accedere ai dati lo fanno mediante la propriet� getData della classe, che a seconda del contesto
di esecuzione sar� una classe che si interfaccia ai web service del server (se eseguita lato client) oppure una
classe con identica interfaccia che invoca i metodi della classe [GetData](jsGetData.md).


La classe MetaData espone quindi una serie di metodi che descrivono specifiche propriet� delle tabelle:

#### {object} isValid({DataRow}r)
Stabilisce se una riga � valida o meno. Si intende contenere delle verifiche semplici, da eseguirsi sul client
 senza uso di web services, altrimenti potrebbe essere meglio implementato come logica di Business.

Restituisce un Deferred a un oggetto cos� strutturato:

        {  
           {string} warningMsg,  //messaggio di avviso se trattasi di messaggio ignorabile
           {string} errMsg,      //messaggio di errore se trattasi di messaggio non ignorabile
           {string} errField,    //campo che ha generato il problema 
           {object} row          //riga che ha generato il problema
        }

lato client, ove vi sia un messaggio ignorabile, di solito � mostrato per conferma. I messaggi non ignorabili invece
 determinano implicitamente una condizione di non validit�.
Lato server � possibile inserire un'invocazione del metodo isValid ma di default non � implementato per non creare 
 una potenziale sovrapposizione con i controlli lato client. 

### getNewRow ({objectRow} parentRow, {DataTable} dtDest)
Crea una riga nella tabella dtDest (che sar� del tipo associato al metadato corrente), avente come riga parent
(opzionale) la riga parentRow.

In questo metodo � possibile definire tutte le propriet� dei campi ad autoincremento specifiche della tabella.

Le propriet� ad autoincremento sono descritte nel documento [PostData](PostData.md) e si impostano
tramite il metodo AutoIncrementColumn della classe DataTable.

Tipicamente quindi il metodo getNewRow di un metadato (derivato da MetaData) imposter� alcune propriet� delle colonne 
 del DataTable dtDest e poi richiamer� il metodo getNewRow della classe base, girando il risultato al chiamante. 

La classe base (MetaData) di suo si occupa di impostare i default sulle colonne ove siano stati definiti, di 
 richiamare il metodo newRow del DataTable

Volendo impostare ad esempio la colonna idorder come autoincremento, il metodo potrebbe essere ridefinito come:

            getNewRow: function (parentRow, dt, editType){ 
				dt.autoIncrement('idorder', { });	
				return this.superClass.getNewRow(parentRow, dt, editType);
			}

Volendo invece avere anche una colonna nOrder che parte da 1 ogni anno (yOrder) potremmo avere:

            getNewRow: function (parentRow, dt, editType){ 
				dt.autoIncrement('idorder', { });
                dt.autoIncrement('nOrder', {selector:['yOrder']});
				return this.superClass.getNewRow(parentRow, dt, editType);
			}

Se poi volessimo avere anche che la numerazione varia in base al campo "tipo ordine", idOrderKind, avremmo:

            getNewRow: function (parentRow, dt, editType){ 
				dt.autoIncrement('idorder', { });
                dt.autoIncrement('nOrder', {selector:['yOrder','idOrderKind']});
				return this.superClass.getNewRow(parentRow, dt, editType);
			}

Se volessimo inserire un certo numero di ordini nella stessa transazione e volessimo essere sicuri che la numerazione
 ottenuta nel salvataggio non andr� mai in conflitto con quella nelle righe ancora da inserire potremmo impostare
 un valore minimo per i valori temporanei (in memoria):

           getNewRow: function (parentRow, dt, editType){
            dt.autoIncrement('idorder', { });
            dt.autoIncrement('nOrder', {minimum:99990001, selector:['yOrder','idOrderKind']});
            return this.superClass.getNewRow(parentRow, dt, editType);
           }


### {string[]} primaryKey
Restituisce l'elenco dei campi chiave della tabella o vista. Per le viste risulta a volte indispensabile poich� il
 DbDescriptor non � in grado in autonomia di ricavare la chiave di una vista. 

A ogni modo quando si disegna il DataSet � bene impostare la chiave primaria di ogni tabella/vista inserita in esso.


### describeAColumn()
Imposta le informazioni su una colonna, quali se ammette null, la caption etc.


### {[sqlFun](jsDataQuery.md)} insertFilter
Deve restituire un filtro da usare quando una riga di questa tabella � ricercata nell'ambito di una riga 
 (di un'altra tabella) � in inserimento. Ossia come riferimento esterno di una riga in stato di inserimento.

Ad esempio, � possibile che solo le righe marcate come "attive" di una tabella siano attribuibili ad altre tabelle
 quando si creano in esse nuove righe. 

In questo caso sar� possibile ridefinire questo metodo per restituire il filtro sul campo attivo.



### {[sqlFun](jsDataQuery.md)} searchFilter
Deve restituire un filtro da usare quando una riga di questa tabella � ricercata nell'ambito di una riga
(di un'altra tabella) � in fase di ricerca, ossia come riferimento esterno in fase di ricerca sulle altre tabelle.




### {Promise<DataTable>} describeColumns({DataTable} table, {string} listType)
Descrive le propriet� di uno o pi� elenchi, ossia modi di visualizzazione di una tabella o vista.
Le propriet� sono descritte attraverso le propriet� delle colonne del DataTable.

### {[sqlFun](jsDataQuery.md)} getStaticFilter({string} listType)
Restituisce un filtro da applicare sempre quando c'� da effettuare la lettura di un elenco "listType" sulla tabella
 o vista relative al metadato.

� usata nei servizi esposti al client che restituiscono degli elenchi, ed eventualmente anche nel client.

### {string} getName
Restituisce il nome applicativo della tabella o vista, da usare ad esempio nei messaggi.

### setDefaults({DataTable} t)
Imposta i valori di default per le colonne quando sono create nuove righe della tabella.

Tali valori sono utilizzati quando si richiama il metodo newRow del [DataTable](jsDataSet.md)

La classe MetaPage di myKode invocano questo metodo, per ogni entit� e subentit�, all'avvio di ogni maschera, 
 in modo che i default siano applicati nei successivi inserimenti di righe.



