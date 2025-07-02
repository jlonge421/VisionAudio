<script>
  import VisionPlayer from './lib/VisionPlayer.svelte'
</script>

<main>
  <VisionPlayer />
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
  }
  }
</style>
