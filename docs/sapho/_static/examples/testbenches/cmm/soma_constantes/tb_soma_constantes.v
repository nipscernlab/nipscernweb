`timescale 1ns/1ps

module tb_soma_constantes;
    reg clk = 1'b0;
    reg rst = 1'b1;
    wire signed [31:0] out;
    wire [0:0] out_en;
    wire cheguei;

    integer ciclos = 0;
    integer recebeu_saida = 0;
    integer terminou = 0;

    soma_constantes dut (
        .clk(clk),
        .rst(rst),
        .out(out),
        .out_en(out_en),
        .cheguei(cheguei)
    );

    always #5 clk = ~clk;

    always @(posedge clk) begin
        if (!rst && (out_en == 1)) begin
            recebeu_saida = 1;
            if ($signed(out) !== 32'sd7) begin
                $display("ERRO: esperado=7 obtido=%0d", $signed(out));
                $fatal(1);
            end
        end

        if (cheguei === 1'b1)
            terminou = 1;
    end

    initial begin
        $dumpfile("tb_soma_constantes.vcd");
        $dumpvars(0, tb_soma_constantes);

        repeat (2) @(posedge clk);
        @(negedge clk);
        rst = 1'b0;

        while (!terminou && (ciclos < 200)) begin
            @(posedge clk);
            ciclos = ciclos + 1;
        end

        repeat (2) @(posedge clk);
        #1;

        if (!recebeu_saida) begin
            $display("ERRO: nenhuma escrita foi observada na porta 0.");
            $fatal(1);
        end

        if (!terminou) begin
            $display("ERRO: tempo limite antes de #TOAQUI.");
            $fatal(1);
        end

        $display("SUCESSO: saida 7 e termino do algoritmo validados.");
        $finish;
    end
endmodule
