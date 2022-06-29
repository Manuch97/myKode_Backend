# DataAccess

Il DataAccess � la classe usata per leggere dal DataBase singole tabelle o singole espressioni, mentre usiamo 
 [GetData](GetData.md) per leggere interi DataSet.
Sebbene sia virtualmente possibile farlo, non usiamo direttamente il DataAccess per salvare dati sul db ma usiamo 
 la classe  [PostData](PostData.md) a tale scopo, che si occupa anche della sicurezza, dei campi ad autoincremento etc.

## Persistenza
Distinguiamo, al momento della creazione di una connessione, due modalit� di gestione: Persistenti e non persistenti, in
 base al parametro (bool) persisting in input al costruttore.
Se la connessione � persistente sar� aperta con la prima open() e poi rimarr� aperta sin quando la connessione non sar�
 rilasciata.
Viceversa sar� aperta e chiusa ogni volta che ci sar� una open() o una close(), ma ovviamente se si cercher� di eseguire
 un'operazione sul db con la connessione chiusa ci sar� un errore, inoltre i tempi della open() sono molto lunghi se
 comparati ai tempi del processore.

Se la connessione � impostata come persistente, successive open() sono ammesse e incrementano solo un livello di annidamento
 ma non hanno alcun effetto sulla connessione fisica. Similmente le close().
Pertanto si pu� decidere a livello di applicazione se usare connessioni persistenti o meno, e nel codice di ogni metodo
 che accede direttamente al db racchiudere le istruzioni di accesso tra una open() ed una close(), e questi metodi
 funzioneranno qualsiasi sia l'impostazione stabilita globalmente:

Se persisting � true:
```
  conn.open() //aumenta solo un livello di annidamento interno, non ha alcun effetto fisico

  /// operazioni su conn
  
  conn.close() //diminuisce solo un livello di annidamento interno, non ha alcun effetto fisico

```


Se persisting � false:
```
  conn.open() //apre la connessione ove non sia gi� apera, o aumenta un livello di annidamento se � gi� aperta

  /// operazioni su conn
  
  conn.close() //diminuisce il livello di annidamento e chiude la connessione se questo � sceso a zero

```


Come si pu� vedere, il codice di un generico metodo che accede al db pu� essere scritto in modo identico a prescindere
 da come si intenda gestire la persistenza della connessione.


## Funzioni che leggono una singola espressione

Per i parametri esatti, consultare il jsDoc
- readSingleValue



