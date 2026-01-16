This is a work in progress.

  

<center><h1>A SKILL TREE FOR WHATEVER YOU NEED IN LIFE</center></h1>

This is a vibe-coded project. I will comb through it on my own time, but I really don't much like Type/Javascript, therefore I am taking the easy approach.

<center><h2>USAGE</h2></center>

  

### Key Ideas:

* A designable tree that you yourself can link with your notes and [tasks](https://github.com/obsidian-tasks-group/obsidian-tasks)
* An exp level gamify the experience and to help you keep track of what you have already accomplished!


  

### Road Map:
```mermaid
flowchart 
	skillTree[ A free-forming node skill tree!]
	linksTo[✅ Links to markdown notes]
	arrows[✅ Arrows that point anywhere to another node]
	multiTreeSupport[Multi tree support]
	parsingMarkdown[ Parsing of makrdown notes]
	displayContents[ Displaying contents of markdown notes when hovering over a node]
	customCharacters[ Custom guiding characters]
	userStyles[User controlled styling and shapes of nodes]
	nodeStates[✅ Node states dependent/update on hierarchical connections]
	selectableNodes[✅ Selectable nodes]
	displayStats[Display Stats Modal]
	settings[User settings]
	floatingTasks[Tasks orbiting node]
	parsingFrontMatter[Getting information from a notes frontmatter]
	display[Display Complete]
	json[Importable and Exportable trees with json]
	
	
	
	multiTreeSupport --> json
	skillTree --> arrows --> nodeStates --> selectableNodes --> linksTo
	skillTree --> display --> tasks --> floatingTasks
	skillTree --> settings --> userStyles
	skillTree --> json
	
	linksTo --> displayContents
	linksTo --> parsingMarkdown
	
	selectableNodes --> displayStats --> parsingFrontMatter

	
	parsingMarkdown --> parsingFrontMatter --> userStyles


	classDef done fill:#d4edda,stroke:#28a745,stroke-width:2px
    classDef progress fill:#fff3cd,stroke:#ffc107,stroke-width:2px
    classDef unstarted fill:#f8d7da,stroke:#dc3545,stroke-width:2px
    
    class linksTo,arrows,nodeStates,selectableNodes done
    
```

