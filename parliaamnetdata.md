Yes. I checked the current Andhra Pradesh constituency structure against the Election Commission/official delimitation material. Andhra Pradesh has **25 Lok Sabha constituencies and 175 Assembly constituencies**, with **7 Assembly segments per Parliament constituency**. ([Election Commission of India][1])

For your application, I recommend using the following exact master structure and codes.

| Code      | Parliament Constituency | 7 Assembly Constituencies                                                                                             |
| --------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **APP01** | **Araku (ST)**          | Palakonda (ST), Kurupam (ST), Parvathipuram (SC), Salur (ST), Araku Valley (ST), Paderu (ST), Rampachodavaram (ST)    |
| **APP02** | **Srikakulam**          | Ichchapuram, Palasa, Tekkali, Pathapatnam, Srikakulam, Amadalavalasa, Narasannapeta                                   |
| **APP03** | **Vizianagaram**        | Etcherla, Rajam (SC), Bobbili, Cheepurupalli, Gajapathinagaram, Nellimarla, Vizianagaram                              |
| **APP04** | **Visakhapatnam**       | Srungavarapukota, Bhimili, Visakhapatnam East, Visakhapatnam South, Visakhapatnam North, Visakhapatnam West, Gajuwaka |
| **APP05** | **Anakapalle**          | Chodavaram, Madugula, Anakapalle, Pendurthi, Yelamanchili, Payakaraopet (SC), Narsipatnam                             |
| **APP06** | **Kakinada**            | Tuni, Prathipadu, Pithapuram, Kakinada Rural, Peddapuram, Kakinada City, Jaggampeta                                   |
| **APP07** | **Amalapuram (SC)**     | Ramachandrapuram, Mummidivaram, Amalapuram (SC), Razole (SC), Gannavaram (SC), Kothapeta, Mandapeta                   |
| **APP08** | **Rajahmundry**         | Anaparthy, Rajanagaram, Rajahmundry City, Rajahmundry Rural, Kovvur (SC), Nidadavole, Gopalapuram (SC)                |
| **APP09** | **Narasapuram**         | Achanta, Palacole, Narasapuram, Bhimavaram, Undi, Tanuku, Tadepalligudem                                              |
| **APP10** | **Eluru**               | Unguturu, Denduluru, Eluru, Polavaram (ST), Chintalapudi (SC), Nuzvid, Kaikalur                                       |
| **APP11** | **Machilipatnam**       | Gannavaram, Gudivada, Pedana, Machilipatnam, Avanigadda, Pamarru (SC), Penamaluru                                     |
| **APP12** | **Vijayawada**          | Tiruvuru (SC), Vijayawada West, Vijayawada Central, Vijayawada East, Mylavaram, Nandigama (SC), Jaggayyapeta          |
| **APP13** | **Guntur**              | Tadikonda (SC), Mangalagiri, Ponnuru, Tenali, Prathipadu (SC), Guntur West, Guntur East                               |
| **APP14** | **Narasaraopet**        | Pedakurapadu, Chilakaluripet, Narasaraopet, Sattenapalli, Vinukonda, Gurajala, Macherla                               |
| **APP15** | **Bapatla (SC)**        | Vemuru (SC), Repalle, Bapatla, Parchur, Addanki, Chirala, Santhanuthalapadu (SC)                                      |
| **APP16** | **Ongole**              | Yerragondapalem (SC), Darsi, Ongole, Kondapi (SC), Markapuram, Giddalur, Kanigiri                                     |
| **APP17** | **Nandyal**             | Allagadda, Srisailam, Nandikotkur (SC), Panyam, Nandyal, Banaganapalle, Dhone                                         |
| **APP18** | **Kurnool**             | Kurnool, Pattikonda, Kodumur (SC), Yemmiganur, Mantralayam, Adoni, Alur                                               |
| **APP19** | **Anantapur**           | Rayadurg, Uravakonda, Guntakal, Tadpatri, Singanamala (SC), Anantapur Urban, Kalyandurg                               |
| **APP20** | **Hindupur**            | Raptadu, Madakasira (SC), Hindupur, Penukonda, Puttaparthi, Dharmavaram, Kadiri                                       |
| **APP21** | **Kadapa**              | Badvel (SC), Kadapa, Pulivendla, Kamalapuram, Jammalamadugu, Proddatur, Mydukur                                       |
| **APP22** | **Nellore**             | Kandukur, Kavali, Atmakur, Kovur, Nellore City, Nellore Rural, Udayagiri                                              |
| **APP23** | **Tirupati (SC)**       | Sarvepalli, Gudur (SC), Sullurpeta (SC), Venkatagiri, Tirupati, Srikalahasti, Satyavedu (SC)                          |
| **APP24** | **Rajampet**            | Rajampet, Kodur (SC), Rayachoti, Thamballapalle, Pileru, Madanapalle, Punganur                                        |
| **APP25** | **Chittoor (SC)**       | Chandragiri, Nagari, Gangadhara Nellore (SC), Chittoor, Puthalapattu (SC), Palamaner, Kuppam                          |

The official delimitation schedule provides this Parliament-to-Assembly mapping; the ECI document lists the 25 parliamentary constituencies and their seven Assembly segments. ([AP State Seeds Development][2])

### Your employee-code structure

Now your 200 records become very clean:

**Parliament staff — 25**

```text
APP01
APP02
APP03
...
APP25
```

**Assembly staff — 175**

```text
APP01A01
APP01A02
APP01A03
APP01A04
APP01A05
APP01A06
APP01A07

APP02A01
APP02A02
...
APP25A07
```

For example:

```text
APP13
```

means **Guntur Parliament staff**.

```text
APP13A07
```

means:

**Andhra Pradesh → Guntur Parliament → Assembly 07 → Guntur East**

And:

```text
APP12A03
```

means:

**Andhra Pradesh → Vijayawada Parliament → Assembly 03 → Vijayawada Central**

### I recommend your Excel/database have these columns

```text
EmployeeCode
Level
ParliamentCode
ParliamentName
AssemblyCode
AssemblyName
EmployeeName
Mobile
Username
Password
Status
```

For the Parliament-level employee:

```text
APP13
Parliament
APP13
Guntur
NULL
NULL
Employee Name
...
```

For an Assembly employee:

```text
APP13A07
Assembly
APP13
Guntur
A07
Guntur East
Employee Name
...
```

This is much better than putting the constituency name directly into the employee ID because **the code remains stable while the displayed constituency information is stored separately**.

Also, for the application itself, I would create separate **Parliament Master** and **Assembly Master** tables and link employees to them with IDs. That will let you search:

**Parliament → Assembly → Employee → Tasks → Submissions**

without duplicating constituency data throughout the system.

[1]: https://www.eci.gov.in/election-details/2024/S01/3?utm_source=chatgpt.com "General Election to Legislative Assembly of Andhra ..."
[2]: https://apseeds.ap.gov.in/PDF/apreorg/APRegACT2014.pdf "1"
